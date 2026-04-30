import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimsArtifact, EvalDiagnostic, EvalReport, EvidenceArtifact, ReviewArtifact, SourceChunksArtifact, SourceInventory, TraceEvent } from "./types.js";
import { validateRunIntegrity } from "./integrity.js";
import { runHarness } from "./pipeline.js";
import { loadRunArtifactBundle } from "./run-bundle.js";
import { renderRunReportHtml } from "./run-report.js";

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
  requires_verified_excerpts?: boolean;
  min_scores: Record<string, number>;
  required_artifacts?: string[];
  required_eval_council_roles?: Array<EvalReport["council"]["reviewers"][number]["role_id"]>;
  required_diagnostics?: string[];
  forbidden_diagnostics?: string[];
  required_trace_stages?: string[];
  required_report_anchors?: string[];
  expected_failure?: {
    stage: string;
    category: string;
    severity?: EvalDiagnostic["severity"];
  };
  required_review_summary?: {
    approved_claims?: string[];
    rejected_claims?: string[];
    evidence_annotations?: string[];
    stage_rerun_requests?: string[];
  };
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
    source_chunks: number;
    source_backed_evidence: number;
    verified_excerpts: number;
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
  const [claims, evidence, contradictions, sourceInventory, sourceChunks, memo, redTeam, evalReport, questionSpec] = await Promise.all([
    readJson<ClaimsArtifact>(runDir, "claims.json"),
    readJson<EvidenceArtifact>(runDir, "evidence.json"),
    readJson<{ contradictions: unknown[] }>(runDir, "contradictions.json"),
    readJson<SourceInventory>(runDir, "source_inventory.json"),
    readJson<SourceChunksArtifact>(runDir, "source_chunks.json"),
    readText(runDir, "decision_memo.md"),
    readText(runDir, "red_team.md"),
    readJson<EvalReport>(runDir, "eval_report.json"),
    readJson<{ question: string; context: string }>(runDir, "question_spec.json")
  ]);

  for (const artifact of expectation.required_artifacts ?? []) {
    if (!existsSync(path.join(runDir, artifact))) {
      failures.push(`${expectation.scenario_id}: missing required artifact ${artifact}.`);
    }
  }

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
  const verifiedExcerpts = countVerifiedExcerpts(evidence, sourceChunks);
  if (expectation.min_source_backed_evidence !== undefined && sourceBackedEvidence < expectation.min_source_backed_evidence) {
    failures.push(`${expectation.scenario_id}: expected at least ${expectation.min_source_backed_evidence} source-backed evidence items, got ${sourceBackedEvidence}.`);
  }

  if (expectation.requires_verified_excerpts && verifiedExcerpts < sourceBackedEvidence) {
    failures.push(`${expectation.scenario_id}: expected all source-backed evidence excerpts to verify, got ${verifiedExcerpts}/${sourceBackedEvidence}.`);
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

  const councilRoles = new Set(evalReport.council.reviewers.map((reviewer) => reviewer.role_id));
  for (const role of expectation.required_eval_council_roles ?? []) {
    if (!councilRoles.has(role)) {
      failures.push(`${expectation.scenario_id}: eval council missing required role ${role}.`);
    }
  }

  for (const diagnosticNeedle of expectation.required_diagnostics ?? []) {
    if (!evalReport.diagnostics.some((diagnostic) => matchesDiagnostic(diagnostic, diagnosticNeedle))) {
      failures.push(`${expectation.scenario_id}: missing required diagnostic ${diagnosticNeedle}.`);
    }
  }

  for (const diagnosticNeedle of expectation.forbidden_diagnostics ?? []) {
    const matches = evalReport.diagnostics.filter((diagnostic) => matchesDiagnostic(diagnostic, diagnosticNeedle));
    if (matches.length > 0) {
      failures.push(`${expectation.scenario_id}: found forbidden diagnostic ${diagnosticNeedle}: ${matches.map((diagnostic) => diagnostic.id).join(", ")}.`);
    }
  }

  if (expectation.expected_failure) {
    const expectedFailure = expectation.expected_failure;
    const matches = evalReport.diagnostics.some((diagnostic) => {
      return diagnostic.stage === expectedFailure.stage
        && diagnostic.category === expectedFailure.category
        && (!expectedFailure.severity || diagnostic.severity === expectedFailure.severity);
    });
    if (!matches) {
      failures.push(`${expectation.scenario_id}: expected failure ${expectedFailure.stage}/${expectedFailure.category} was not emitted.`);
    }
  }

  if ((expectation.required_trace_stages ?? []).length > 0) {
    const trace = await readTrace(runDir);
    const stages = new Set(trace.map((event) => event.stage));
    for (const stage of expectation.required_trace_stages ?? []) {
      if (!stages.has(stage)) {
        failures.push(`${expectation.scenario_id}: trace missing required stage ${stage}.`);
      }
    }
  }

  if ((expectation.required_report_anchors ?? []).length > 0) {
    const projectRoot = inferProjectRoot(runDir);
    const html = renderRunReportHtml(await loadRunArtifactBundle(projectRoot, runDir));
    for (const anchor of expectation.required_report_anchors ?? []) {
      if (!html.includes(`id="${anchor}"`)) {
        failures.push(`${expectation.scenario_id}: run report missing required anchor ${anchor}.`);
      }
    }
  }

  if (expectation.required_review_summary) {
    const review = await readOptionalJson<ReviewArtifact>(runDir, "review.json");
    if (!review) {
      failures.push(`${expectation.scenario_id}: missing review.json for required review summary.`);
    } else {
      validateReviewSummary(expectation.scenario_id, review, expectation.required_review_summary, failures);
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
      source_chunks: sourceChunks.chunks.length,
      source_backed_evidence: sourceBackedEvidence,
      verified_excerpts: verifiedExcerpts
    }
  };
}

function matchesDiagnostic(diagnostic: EvalDiagnostic, needle: string): boolean {
  const normalizedNeedle = needle.toLowerCase();
  return [
    diagnostic.id,
    diagnostic.stage,
    diagnostic.severity,
    diagnostic.category,
    diagnostic.message,
    diagnostic.recommended_fix
  ].some((value) => value.toLowerCase().includes(normalizedNeedle));
}

function validateReviewSummary(
  scenarioId: string,
  review: ReviewArtifact,
  required: NonNullable<BenchmarkExpectation["required_review_summary"]>,
  failures: string[]
): void {
  for (const claimId of required.approved_claims ?? []) {
    if (!review.summary.approved_claims.includes(claimId)) {
      failures.push(`${scenarioId}: review summary missing approved claim ${claimId}.`);
    }
  }

  for (const claimId of required.rejected_claims ?? []) {
    if (!review.summary.rejected_claims.includes(claimId)) {
      failures.push(`${scenarioId}: review summary missing rejected claim ${claimId}.`);
    }
  }

  const evidenceAnnotationIds = new Set(review.summary.evidence_annotations.map((annotation) => annotation.evidence_id));
  for (const evidenceId of required.evidence_annotations ?? []) {
    if (!evidenceAnnotationIds.has(evidenceId)) {
      failures.push(`${scenarioId}: review summary missing evidence annotation ${evidenceId}.`);
    }
  }

  for (const stage of required.stage_rerun_requests ?? []) {
    if (!review.summary.stage_rerun_requests.includes(stage)) {
      failures.push(`${scenarioId}: review summary missing stage rerun request ${stage}.`);
    }
  }
}

function countVerifiedExcerpts(evidence: EvidenceArtifact, sourceChunks: SourceChunksArtifact): number {
  const chunksById = new Map(sourceChunks.chunks.map((chunk) => [chunk.id, chunk.text]));
  return evidence.evidence.filter((item) => {
    if ((item.source_ids ?? []).length === 0) {
      return false;
    }
    if (!item.excerpt || (item.chunk_ids ?? []).length === 0) {
      return false;
    }

    return item.chunk_ids?.some((chunkId) => {
      const chunkText = chunksById.get(chunkId);
      return chunkText ? normalizeForExcerpt(chunkText).includes(normalizeForExcerpt(item.excerpt ?? "")) : false;
    }) ?? false;
  }).length;
}

function normalizeForExcerpt(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
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

async function readOptionalJson<T>(runDir: string, file: string): Promise<T | undefined> {
  try {
    return await readJson<T>(runDir, file);
  } catch {
    return undefined;
  }
}

async function readTrace(runDir: string): Promise<TraceEvent[]> {
  const raw = await readText(runDir, "trace.jsonl");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceEvent);
}

async function readText(runDir: string, file: string): Promise<string> {
  return readFile(path.join(runDir, file), "utf8");
}

function inferProjectRoot(runDir: string): string {
  const absoluteRunDir = path.resolve(runDir);
  if (path.basename(path.dirname(absoluteRunDir)) === "runs") {
    return path.dirname(path.dirname(absoluteRunDir));
  }
  return process.cwd();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
