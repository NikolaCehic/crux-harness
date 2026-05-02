import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { checkBenchmarkExpectation, type BenchmarkExpectation } from "../../src/benchmark.js";
import { runHarness, rerunEvaluation } from "../../src/pipeline.js";

const projectRoot = process.cwd();
const scenarioInput = "e2e/scenarios/strategic-tech.yaml";

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("extended expectation DSL verifies product-grade run contracts", async () => {
  const result = await runHarness(projectRoot, scenarioInput);
  const baseExpectation = JSON.parse(
    await readFile(path.join(projectRoot, "e2e/expectations/strategic-tech.json"), "utf8")
  ) as BenchmarkExpectation;

  const expectation: BenchmarkExpectation = {
    ...baseExpectation,
    required_artifacts: [
      "run_config.json",
      "question_spec.json",
      "source_inventory.json",
      "source_chunks.json",
      "claims.json",
      "evidence.json",
      "contradictions.json",
      "red_team.md",
      "uncertainty.json",
      "decision_memo.md",
      "agent_manifest.json",
      "agent_findings.json",
      "eval_report.json",
      "trace.jsonl"
    ],
    required_eval_council_roles: [
      "evidence_auditor",
      "faithfulness_auditor",
      "red_team_auditor",
      "synthesis_judge"
    ],
    forbidden_diagnostics: ["faithfulness", "missing_evidence_coverage", "vague_uncertainty"],
    required_trace_stages: [
      "normalize_question",
      "ingest_sources",
      "build_claim_graph",
      "gather_evidence",
      "verify_claims",
      "red_team",
      "model_uncertainty",
      "write_decision_memo",
      "run_agents",
      "evaluate"
    ],
    required_report_anchors: ["summary", "memo", "claims", "evidence", "sources", "agents", "eval", "diagnostics", "trace"]
  };

  const actual = await checkBenchmarkExpectation(result.runDir, expectation);

  assert.deepEqual(actual.failures, []);
  assert.equal(actual.scores.schema_validity, 1);
});

test("extended expectation DSL can assert known failure modes and review summaries", async () => {
  const result = await runHarness(projectRoot, scenarioInput);
  const memoPath = path.join(result.runDir, "decision_memo.md");
  const memo = await readFile(memoPath, "utf8");
  await writeFile(memoPath, `${memo}\n\nThis opportunity is guaranteed and has no risk.\n`, "utf8");
  await rerunEvaluation(projectRoot, result.runDir);

  const review = {
    schema_version: "crux.review.v1",
    run_id: "manual-review-fixture",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    actions: [],
    summary: {
      approved_claims: ["C1"],
      rejected_claims: ["C2"],
      evidence_annotations: [{ evidence_id: "E1", note_count: 1 }],
      stage_rerun_requests: ["write_decision_memo"]
    }
  };
  await writeFile(path.join(result.runDir, "review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8");

  const expectation: BenchmarkExpectation = {
    scenario_id: "strategic-tech-known-failure",
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
    required_diagnostics: ["faithfulness"],
    expected_failure: {
      stage: "write_decision_memo",
      category: "faithfulness",
      severity: "high"
    },
    required_review_summary: {
      approved_claims: ["C1"],
      rejected_claims: ["C2"],
      evidence_annotations: ["E1"],
      stage_rerun_requests: ["write_decision_memo"]
    }
  };

  const actual = await checkBenchmarkExpectation(result.runDir, expectation);

  assert.deepEqual(actual.failures, []);
  assert.equal(actual.scores.faithfulness < 1, true);
});
