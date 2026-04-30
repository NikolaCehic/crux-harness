import assert from "node:assert/strict";
import { appendFile, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { checkBenchmarkExpectation, type BenchmarkExpectation } from "../../src/benchmark.js";
import { checkReplayCompatibility } from "../../src/contracts.js";
import { validateRunIntegrity } from "../../src/integrity.js";
import { rerunEvaluation, runHarness } from "../../src/pipeline.js";
import type { EvidenceArtifact } from "../../src/types.js";

const projectRoot = process.cwd();
const scenarioInput = "e2e/scenarios/root-cause-analysis.yaml";

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("adversarial suite catches tampered evidence excerpts", async () => {
  const result = await runHarness(projectRoot, scenarioInput);
  const evidencePath = path.join(result.runDir, "evidence.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8")) as EvidenceArtifact;
  const sourceBacked = evidence.evidence.find((item) => item.source_type !== "calculation" && (item.chunk_ids ?? []).length > 0);
  assert.ok(sourceBacked, "scenario should include source-backed evidence");
  sourceBacked.excerpt = "This forged excerpt does not appear in the cited source chunk.";
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  const integrity = await validateRunIntegrity(projectRoot, result.runDir);

  assert.equal(integrity.valid, false);
  assert.equal(integrity.failures.some((failure) => failure.includes("excerpt is not present")), true);
});

test("adversarial suite catches replay input hash drift", async () => {
  const result = await runHarness(projectRoot, scenarioInput);
  await appendFile(path.join(result.runDir, "input.yaml"), "\n# adversarial drift\n", "utf8");

  const replay = await checkReplayCompatibility(projectRoot, result.runDir);

  assert.equal(replay.compatible, false);
  assert.equal(replay.blocking_issues.some((issue) => issue.includes("Copied input hash changed")), true);
});

test("adversarial suite asserts expected red-team failure diagnostics", async () => {
  const result = await runHarness(projectRoot, scenarioInput);
  await writeFile(path.join(result.runDir, "red_team.md"), "## Opposing Thesis\n\nThis might fail.\n", "utf8");
  await rerunEvaluation(projectRoot, result.runDir);

  const expectation: BenchmarkExpectation = {
    scenario_id: "root-cause-weak-red-team",
    min_claims: 1,
    min_evidence: 1,
    min_contradictions: 0,
    required_claim_types: [],
    required_terms: [],
    required_memo_sections: [],
    required_red_team_sections: [],
    min_scores: {
      schema_validity: 1
    },
    required_eval_council_roles: ["red_team_auditor", "synthesis_judge"],
    required_diagnostics: ["weak_red_team"],
    expected_failure: {
      stage: "red_team",
      category: "weak_red_team",
      severity: "high"
    }
  };

  const actual = await checkBenchmarkExpectation(result.runDir, expectation);

  assert.deepEqual(actual.failures, []);
  assert.equal(actual.scores.red_team_strength < 0.65, true);
});
