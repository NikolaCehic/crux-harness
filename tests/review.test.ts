import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { addClaimReview, addEvidenceAnnotation, exportReviewedMemo, initReview } from "../src/review.js";
import { runHarness } from "../src/pipeline.js";
import { ArtifactValidator, schemaIds } from "../src/validator.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";
const cliPath = "dist/src/cli.js";
const deterministicEnv = {
  ...process.env,
  CRUX_CLAIM_DECOMPOSER: "deterministic",
  CRUX_EVIDENCE_MAPPER: "deterministic",
  CRUX_LLM_PROVIDER: "",
  CRUX_LLM_API_KEY: ""
};

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("initReview creates a schema-valid empty review artifact", async () => {
  const run = await runHarness(projectRoot, exampleInput);
  const review = await initReview(projectRoot, run.runDir);
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const result = await validator.validate(schemaIds.review, review);

  assert.equal(review.schema_version, "crux.review.v1");
  assert.equal(review.actions.length, 0);
  assert.equal(review.summary.approved_claims.length, 0);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(existsSync(path.join(run.runDir, "review.json")), true);
});

test("claim review actions persist summaries and trace events", async () => {
  const run = await runHarness(projectRoot, exampleInput);
  await addClaimReview(projectRoot, run.runDir, {
    claimId: "C2",
    status: "rejected",
    reviewer: "analyst",
    rationale: "The source evidence does not yet prove urgency."
  });
  await addClaimReview(projectRoot, run.runDir, {
    claimId: "C6",
    status: "approved",
    reviewer: "analyst",
    rationale: "The staged commitment recommendation is appropriately cautious."
  });

  const review = JSON.parse(await readFile(path.join(run.runDir, "review.json"), "utf8"));
  const trace = await readFile(path.join(run.runDir, "trace.jsonl"), "utf8");

  assert.deepEqual(review.summary.rejected_claims, ["C2"]);
  assert.deepEqual(review.summary.approved_claims, ["C6"]);
  assert.equal(review.actions.length, 2);
  assert.match(trace, /human_review/);
  assert.match(trace, /claim C2 rejected/);
});

test("evidence annotations and reviewed memo export preserve human context", async () => {
  const run = await runHarness(projectRoot, exampleInput);
  await addClaimReview(projectRoot, run.runDir, {
    claimId: "C2",
    status: "rejected",
    reviewer: "analyst",
    rationale: "Needs direct buyer evidence."
  });
  await addEvidenceAnnotation(projectRoot, run.runDir, {
    evidenceId: "E1",
    reviewer: "analyst",
    note: "Useful directional evidence, not enough for a final investment decision."
  });

  const exportPath = await exportReviewedMemo(projectRoot, run.runDir, "reviewed_memo.md");
  const memo = await readFile(path.join(projectRoot, exportPath), "utf8");

  assert.match(memo, /# Reviewed Crux Memo/);
  assert.match(memo, /Rejected claims: C2/);
  assert.match(memo, /E1: Useful directional evidence/);
  assert.match(memo, /Machine-generated memo follows/);
});

test("compiled CLI records review actions and exports a reviewed memo", async () => {
  const run = await runHarness(projectRoot, exampleInput);
  const runDir = path.relative(projectRoot, run.runDir);

  const claim = await execFileAsync(process.execPath, [
    cliPath,
    "review",
    "claim",
    runDir,
    "C2",
    "--status",
    "rejected",
    "--reviewer",
    "analyst",
    "--rationale",
    "Needs better evidence."
  ], { cwd: projectRoot, env: deterministicEnv });
  assert.match(claim.stdout, /Review action recorded: R1/);

  const evidence = await execFileAsync(process.execPath, [
    cliPath,
    "review",
    "evidence",
    runDir,
    "E1",
    "--reviewer",
    "analyst",
    "--note",
    "Good direction, limited proof."
  ], { cwd: projectRoot, env: deterministicEnv });
  assert.match(evidence.stdout, /Review action recorded: R2/);

  const exported = await execFileAsync(process.execPath, [cliPath, "review", "export", runDir, "--out", "reviewed_memo.md"], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(exported.stdout, /Reviewed memo written:/);
  assert.equal(existsSync(path.join(run.runDir, "reviewed_memo.md")), true);
});
