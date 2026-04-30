import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { evaluateRun } from "../src/evaluator.js";
import { runHarness } from "../src/pipeline.js";

const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("diagnostics classify missing claim evidence at the evidence stage", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const claimsPath = path.join(result.runDir, "claims.json");
  const claims = JSON.parse(await readFile(claimsPath, "utf8"));
  claims.claims[1].status = "supported";
  claims.claims[1].evidence_ids = [];
  claims.claims[1].counterevidence_ids = [];
  await writeFile(claimsPath, `${JSON.stringify(claims, null, 2)}\n`, "utf8");

  const evalReport = await evaluateRun(projectRoot, result.runDir);
  const evidenceReview = evalReport.council.reviewers.find((reviewer) => reviewer.role_id === "evidence_auditor");

  assert.equal(evidenceReview?.status, "fail");
  assert.equal(evalReport.council.synthesis.status, "fail");
  assert.equal(evalReport.diagnostics.some((diagnostic) => {
    return diagnostic.stage === "gather_evidence"
      && diagnostic.category === "missing_evidence_coverage"
      && diagnostic.message.includes("C2");
  }), true);
});

test("diagnostics classify vague uncertainty at the uncertainty stage", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const uncertaintyPath = path.join(result.runDir, "uncertainty.json");
  const uncertainty = JSON.parse(await readFile(uncertaintyPath, "utf8"));
  uncertainty.key_uncertainties = uncertainty.key_uncertainties.map((item: { id: string; confidence: number }) => ({
    id: item.id,
    description: "TBD",
    current_estimate: "unknown",
    confidence: item.confidence,
    impact_if_wrong: "bad",
    evidence_needed: "more"
  }));
  uncertainty.what_would_change_my_mind = ["more data", "more data", "more data", "more data", "more data"];
  uncertainty.recommended_tests = ["research", "research", "research", "research", "research"];
  await writeFile(uncertaintyPath, `${JSON.stringify(uncertainty, null, 2)}\n`, "utf8");

  const evalReport = await evaluateRun(projectRoot, result.runDir);
  const uncertaintyReview = evalReport.council.reviewers.find((reviewer) => reviewer.role_id === "uncertainty_auditor");

  assert.equal(evalReport.scores.uncertainty_quality < 0.7, true);
  assert.equal(uncertaintyReview?.status, "fail");
  assert.equal(evalReport.diagnostics.some((diagnostic) => {
    return diagnostic.stage === "model_uncertainty" && diagnostic.category === "vague_uncertainty";
  }), true);
});

test("diagnostics classify unsupported memo language at the memo stage", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const memoPath = path.join(result.runDir, "decision_memo.md");
  const memo = await readFile(memoPath, "utf8");
  await writeFile(memoPath, `${memo}\n\nThis opportunity is guaranteed and has no risk.\n`, "utf8");

  const evalReport = await evaluateRun(projectRoot, result.runDir);

  assert.equal(evalReport.diagnostics.some((diagnostic) => {
    return diagnostic.stage === "write_decision_memo"
      && diagnostic.category === "faithfulness"
      && diagnostic.severity === "high";
  }), true);
});
