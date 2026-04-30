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

const expectedCouncilRoles = [
  "evidence_auditor",
  "claim_graph_auditor",
  "faithfulness_auditor",
  "red_team_auditor",
  "uncertainty_auditor",
  "decision_utility_auditor",
  "domain_reviewer",
  "synthesis_judge"
];

test("eval report includes a complete deterministic evaluator council", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const evalReport = JSON.parse(await readFile(path.join(result.runDir, "eval_report.json"), "utf8"));

  assert.equal(evalReport.council.schema_version, "crux.eval_council.v1");
  assert.deepEqual(
    evalReport.council.reviewers.map((reviewer: { role_id: string }) => reviewer.role_id),
    expectedCouncilRoles
  );
  assert.equal(evalReport.council.synthesis.status, "pass");
  assert.deepEqual(evalReport.council.synthesis.blocking_failures, []);
  assert.equal(evalReport.council.reviewers.every((reviewer: { score: number }) => reviewer.score >= 0 && reviewer.score <= 1), true);
});

test("council synthesis keeps faithfulness failures blocking", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const memoPath = path.join(result.runDir, "decision_memo.md");
  const memo = await readFile(memoPath, "utf8");
  await writeFile(memoPath, `${memo}\n\nThis opportunity is guaranteed and has no risk.\n`, "utf8");

  const evalReport = await evaluateRun(projectRoot, result.runDir);
  const faithfulnessReview = evalReport.council.reviewers.find((reviewer) => reviewer.role_id === "faithfulness_auditor");

  assert.equal(faithfulnessReview?.status, "fail");
  assert.equal(evalReport.council.synthesis.status, "fail");
  assert.equal(evalReport.council.synthesis.blocking_failures.some((failure) => failure.toLowerCase().includes("faithfulness")), true);
});

test("council preserves disagreement when red-team output is weak", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  await writeFile(
    path.join(result.runDir, "red_team.md"),
    "## Opposing Thesis\n\nThis is probably too risky.\n",
    "utf8"
  );

  const evalReport = await evaluateRun(projectRoot, result.runDir);
  const redTeamReview = evalReport.council.reviewers.find((reviewer) => reviewer.role_id === "red_team_auditor");
  const decisionReview = evalReport.council.reviewers.find((reviewer) => reviewer.role_id === "decision_utility_auditor");

  assert.equal(redTeamReview?.status, "fail");
  assert.equal(decisionReview?.status, "pass");
  assert.equal(
    evalReport.council.disagreements.some((disagreement) => {
      return disagreement.topic === "red-team-vs-decision-utility" && disagreement.positions.some((position) => position.role_id === "red_team_auditor");
    }),
    true
  );
});
