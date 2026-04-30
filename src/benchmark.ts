import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimsArtifact, EvalReport, EvidenceArtifact } from "./types.js";
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
  min_scores: Record<string, number>;
};

export type BenchmarkScenarioResult = {
  scenario: string;
  runDir: string;
  passed: boolean;
  failures: string[];
};

export type BenchmarkReport = {
  passed: boolean;
  scenario_count: number;
  results: BenchmarkScenarioResult[];
};

export async function runBenchmark(
  projectRoot: string,
  scenariosDir = "e2e/scenarios",
  expectationsDir = "e2e/expectations"
): Promise<BenchmarkReport> {
  const absoluteScenariosDir = path.resolve(projectRoot, scenariosDir);
  const scenarioFiles = (await readdir(absoluteScenariosDir))
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .sort();

  const results: BenchmarkScenarioResult[] = [];

  for (const scenarioFile of scenarioFiles) {
    const scenarioPath = path.join(absoluteScenariosDir, scenarioFile);
    const scenarioName = path.basename(scenarioFile).replace(/\.(yaml|yml)$/i, "");
    const expectationPath = path.resolve(projectRoot, expectationsDir, `${scenarioName}.json`);
    const expectation = await readExpectation(expectationPath);
    const run = await runHarness(projectRoot, scenarioPath);
    const integrity = await validateRunIntegrity(projectRoot, run.runDir);
    const expectationFailures = await checkBenchmarkExpectation(run.runDir, expectation);
    const failures = [...integrity.failures, ...expectationFailures];

    results.push({
      scenario: scenarioName,
      runDir: path.relative(projectRoot, run.runDir),
      passed: failures.length === 0,
      failures
    });
  }

  return {
    passed: results.every((result) => result.passed),
    scenario_count: results.length,
    results
  };
}

export async function checkBenchmarkExpectation(runDir: string, expectation: BenchmarkExpectation): Promise<string[]> {
  const failures: string[] = [];
  const [claims, evidence, contradictions, memo, redTeam, evalReport, questionSpec] = await Promise.all([
    readJson<ClaimsArtifact>(runDir, "claims.json"),
    readJson<EvidenceArtifact>(runDir, "evidence.json"),
    readJson<{ contradictions: unknown[] }>(runDir, "contradictions.json"),
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

  return failures;
}

async function readExpectation(expectationPath: string): Promise<BenchmarkExpectation> {
  return JSON.parse(await readFile(expectationPath, "utf8")) as BenchmarkExpectation;
}

async function readJson<T>(runDir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
}

async function readText(runDir: string, file: string): Promise<string> {
  return readFile(path.join(runDir, file), "utf8");
}

