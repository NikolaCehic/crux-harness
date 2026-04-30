import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimsArtifact, EvalReport, EvidenceArtifact, SourceInventory } from "./types.js";
import { validateRunIntegrity } from "./integrity.js";
import { runHarness } from "./pipeline.js";

export type BenchmarkExpectation = {
  scenario_id: string;
  min_claims: number;
  min_evidence: number;
  min_contradictions: number;
  required_claim_types: string[];
  required_terms: string[];
  required_memo_sections: string[];
  required_red_team_sections: string[];
  requires_source_pack?: boolean;
  forbid_placeholder_evidence?: boolean;
  min_source_backed_evidence?: number;
  min_scores: Record<string, number>;
};

export type BenchmarkScenarioResult = {
  scenario: string;
  runDir: string;
  passed: boolean;
  duration_ms: number;
  scores: EvalReport["scores"];
  artifact_counts: {
    claims: number;
    evidence: number;
    contradictions: number;
    sources: number;
    source_backed_evidence: number;
  };
  failures: string[];
  regressions: string[];
};

export type BenchmarkReport = {
  schema_version: "crux.benchmark.report.v1";
  generated_at: string;
  passed: boolean;
  summary: {
    scenario_count: number;
    passed_count: number;
    failed_count: number;
    regression_count: number;
  };
  baseline?: {
    path: string;
    regression_threshold: number;
  };
  results: BenchmarkScenarioResult[];
};

export type BenchmarkBaseline = {
  schema_version: "crux.benchmark.baseline.v1";
  description?: string;
  scenarios: Record<
    string,
    {
      scores: Partial<EvalReport["scores"]>;
      artifact_counts?: Partial<BenchmarkScenarioResult["artifact_counts"]>;
    }
  >;
};

export type BenchmarkOptions = {
  scenariosDir?: string;
  expectationsDir?: string;
  baselinePath?: string;
  regressionThreshold?: number;
};

export async function runBenchmark(
  projectRoot: string,
  options: BenchmarkOptions | string = {},
  legacyExpectationsDir?: string
): Promise<BenchmarkReport> {
  const normalizedOptions = normalizeOptions(options, legacyExpectationsDir);
  const scenariosDir = normalizedOptions.scenariosDir;
  const expectationsDir = normalizedOptions.expectationsDir;
  const absoluteScenariosDir = path.resolve(projectRoot, scenariosDir);
  const baseline = normalizedOptions.baselinePath
    ? await readBaseline(path.resolve(projectRoot, normalizedOptions.baselinePath))
    : undefined;
  const scenarioFiles = (await readdir(absoluteScenariosDir))
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort();

  const results: BenchmarkScenarioResult[] = [];

  for (const scenarioFile of scenarioFiles) {
    const startedAt = performance.now();
    const scenarioPath = path.join(absoluteScenariosDir, scenarioFile);
    const scenarioName = path.basename(scenarioFile).replace(/\.(yaml|yml)$/i, "");
    const expectationPath = path.resolve(projectRoot, expectationsDir, `${scenarioName}.json`);
    const expectation = await readExpectation(expectationPath);
    const run = await runHarness(projectRoot, scenarioPath);
    const integrity = await validateRunIntegrity(projectRoot, run.runDir);
    const expectationResult = await checkBenchmarkExpectation(run.runDir, expectation);
    const regressions = baseline
      ? compareToBaseline(
          scenarioName,
          expectationResult.scores,
          expectationResult.artifact_counts,
          baseline,
          normalizedOptions.regressionThreshold
        )
      : [];
    const failures = [...integrity.failures, ...expectationResult.failures, ...regressions];

    results.push({
      scenario: scenarioName,
      runDir: path.relative(projectRoot, run.runDir),
      passed: failures.length === 0,
      duration_ms: round(performance.now() - startedAt),
      scores: expectationResult.scores,
      artifact_counts: expectationResult.artifact_counts,
      failures,
      regressions
    });
  }

  const passedCount = results.filter((result) => result.passed).length;
  const regressionCount = results.reduce((sum, result) => sum + result.regressions.length, 0);

  return {
    schema_version: "crux.benchmark.report.v1",
    generated_at: new Date().toISOString(),
    passed: results.every((result) => result.passed),
    summary: {
      scenario_count: results.length,
      passed_count: passedCount,
      failed_count: results.length - passedCount,
      regression_count: regressionCount
    },
    baseline: normalizedOptions.baselinePath
      ? {
          path: normalizedOptions.baselinePath,
          regression_threshold: normalizedOptions.regressionThreshold
        }
      : undefined,
    results
  };
}

export type BenchmarkExpectationResult = {
  failures: string[];
  scores: EvalReport["scores"];
  artifact_counts: BenchmarkScenarioResult["artifact_counts"];
};

export async function checkBenchmarkExpectation(runDir: string, expectation: BenchmarkExpectation): Promise<BenchmarkExpectationResult> {
  const failures: string[] = [];
  const [claims, evidence, contradictions, sourceInventory, memo, redTeam, evalReport, questionSpec] = await Promise.all([
    readJson<ClaimsArtifact>(runDir, "claims.json"),
    readJson<EvidenceArtifact>(runDir, "evidence.json"),
    readJson<{ contradictions: unknown[] }>(runDir, "contradictions.json"),
    readJson<SourceInventory>(runDir, "source_inventory.json"),
    readText(runDir, "decision_memo.md"),
    readText(runDir, "red_team.md"),
    readJson<EvalReport>(runDir, "eval_report.json"),
    readJson<{ question: string; context: string }>(runDir, "question_spec.json")
  ]);

  if (claims.claims.length < expectation.min_claims) {
    failures.push(`${expectation.scenario_id}: expected at least ${expectation.min_claims} claims, got ${claims.claims.length}.`);
  }

  if (evidence.evidence.length < expectation.min_evidence) {
    failures.push(`${expectation.scenario_id}: expected at least ${expectation.min_evidence} evidence items, got ${evidence.evidence.length}.`);
  }

  if (contradictions.contradictions.length < expectation.min_contradictions) {
    failures.push(`${expectation.scenario_id}: expected at least ${expectation.min_contradictions} contradictions, got ${contradictions.contradictions.length}.`);
  }

  if (expectation.requires_source_pack && sourceInventory.sources.length === 0) {
    failures.push(`${expectation.scenario_id}: expected a non-empty source pack.`);
  }

  const sourceBackedEvidence = evidence.evidence.filter((item) => (item.source_ids ?? []).length > 0).length;
  if (expectation.min_source_backed_evidence !== undefined && sourceBackedEvidence < expectation.min_source_backed_evidence) {
    failures.push(`${expectation.scenario_id}: expected at least ${expectation.min_source_backed_evidence} source-backed evidence items, got ${sourceBackedEvidence}.`);
  }

  if (expectation.forbid_placeholder_evidence) {
    const placeholderEvidence = evidence.evidence.filter((item) => {
      return [item.citation, item.summary, item.limitations].join("\n").toLowerCase().includes("placeholder");
    });
    if (placeholderEvidence.length > 0) {
      failures.push(`${expectation.scenario_id}: expected no placeholder evidence, found ${placeholderEvidence.map((item) => item.id).join(", ")}.`);
    }
  }

  const claimTypes = new Set(claims.claims.map((claim) => claim.type));
  for (const claimType of expectation.required_claim_types) {
    if (!claimTypes.has(claimType as ClaimsArtifact["claims"][number]["type"])) {
      failures.push(`${expectation.scenario_id}: missing required claim type ${claimType}.`);
    }
  }

  for (const section of expectation.required_memo_sections) {
    if (!memo.includes(section)) {
      failures.push(`${expectation.scenario_id}: decision memo missing section ${section}.`);
    }
  }

  for (const section of expectation.required_red_team_sections) {
    if (!redTeam.includes(section)) {
      failures.push(`${expectation.scenario_id}: red-team memo missing section ${section}.`);
    }
  }

  const corpus = [
    questionSpec.question,
    questionSpec.context,
    ...claims.claims.map((claim) => claim.text),
    ...evidence.evidence.map((item) => `${item.citation} ${item.summary}`),
    ...sourceInventory.sources.map((source) => `${source.title} ${source.citation} ${source.summary}`),
    memo,
    redTeam
  ].join("\n").toLowerCase();

  for (const term of expectation.required_terms) {
    if (!corpus.includes(term.toLowerCase())) {
      failures.push(`${expectation.scenario_id}: output corpus missing required term "${term}".`);
    }
  }

  for (const [scoreName, minimum] of Object.entries(expectation.min_scores)) {
    const actual = evalReport.scores[scoreName as keyof EvalReport["scores"]];
    if (actual === undefined) {
      failures.push(`${expectation.scenario_id}: eval report missing score ${scoreName}.`);
    } else if (actual < minimum) {
      failures.push(`${expectation.scenario_id}: expected ${scoreName} >= ${minimum}, got ${actual}.`);
    }
  }

  return {
    failures,
    scores: evalReport.scores,
    artifact_counts: {
      claims: claims.claims.length,
      evidence: evidence.evidence.length,
      contradictions: contradictions.contradictions.length,
      sources: sourceInventory.sources.length,
      source_backed_evidence: sourceBackedEvidence
    }
  };
}

export async function writeBenchmarkReport(reportPath: string, report: BenchmarkReport): Promise<void> {
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function compareToBaseline(
  scenario: string,
  scores: EvalReport["scores"],
  artifactCounts: BenchmarkScenarioResult["artifact_counts"],
  baseline: BenchmarkBaseline,
  regressionThreshold: number
): string[] {
  const expected = baseline.scenarios[scenario];
  if (!expected) {
    return [`${scenario}: missing scenario in baseline.`];
  }

  const regressions: string[] = [];
  for (const [scoreName, baselineScore] of Object.entries(expected.scores)) {
    const actual = scores[scoreName as keyof EvalReport["scores"]];
    if (actual === undefined) {
      regressions.push(`${scenario}: missing score ${scoreName} for baseline comparison.`);
    } else if (actual < baselineScore - regressionThreshold) {
      regressions.push(`${scenario}: ${scoreName} regressed from ${baselineScore} to ${actual} with threshold ${regressionThreshold}.`);
    }
  }

  for (const [countName, baselineCount] of Object.entries(expected.artifact_counts ?? {})) {
    const actual = artifactCounts[countName as keyof BenchmarkScenarioResult["artifact_counts"]];
    if (actual === undefined) {
      regressions.push(`${scenario}: missing artifact count ${countName} for baseline comparison.`);
    } else if (actual < baselineCount) {
      regressions.push(`${scenario}: ${countName} count regressed from ${baselineCount} to ${actual}.`);
    }
  }

  return regressions;
}

function normalizeOptions(options: BenchmarkOptions | string, legacyExpectationsDir?: string): Required<BenchmarkOptions> {
  if (typeof options === "string") {
    return {
      scenariosDir: options,
      expectationsDir: legacyExpectationsDir ?? "e2e/expectations",
      baselinePath: "",
      regressionThreshold: 0.02
    };
  }

  return {
    scenariosDir: options.scenariosDir ?? "e2e/scenarios",
    expectationsDir: options.expectationsDir ?? "e2e/expectations",
    baselinePath: options.baselinePath ?? "",
    regressionThreshold: options.regressionThreshold ?? 0.02
  };
}

async function readExpectation(expectationPath: string): Promise<BenchmarkExpectation> {
  return JSON.parse(await readFile(expectationPath, "utf8")) as BenchmarkExpectation;
}

async function readBaseline(baselinePath: string): Promise<BenchmarkBaseline> {
  return JSON.parse(await readFile(baselinePath, "utf8")) as BenchmarkBaseline;
}

async function readJson<T>(runDir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
}

async function readText(runDir: string, file: string): Promise<string> {
  return readFile(path.join(runDir, file), "utf8");
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
