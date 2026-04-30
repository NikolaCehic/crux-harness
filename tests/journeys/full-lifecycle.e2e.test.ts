import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import type { ClaimsArtifact, EvidenceArtifact, ReviewArtifact } from "../../src/types.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const cliPath = "dist/src/cli.js";
const deterministicEnv = {
  ...process.env,
  CRUX_CLAIM_DECOMPOSER: "deterministic",
  CRUX_EVIDENCE_MAPPER: "deterministic",
  CRUX_LLM_PROVIDER: "",
  CRUX_LLM_API_KEY: ""
};

test("black-box CLI journey covers run inspection, report, review, replay, and diff", async () => {
  const run = await execFileAsync(process.execPath, [cliPath, "run", "e2e/scenarios/product-strategy.yaml"], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  const runMatch = run.stdout.match(/Run complete: (.+)/);
  assert.ok(runMatch, "run command should print the run directory");
  const runDir = runMatch[1].trim();
  const absoluteRunDir = path.join(projectRoot, runDir);

  const inspection = await execFileAsync(process.execPath, [cliPath, "inspect", runDir], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(inspection.stdout, /Crux Run:/);
  assert.match(inspection.stdout, /Integrity: pass/);
  assert.match(inspection.stdout, /Council: pass/);

  const reportPath = path.join(runDir, "journey_report.html");
  const report = await execFileAsync(process.execPath, [cliPath, "report", runDir, "--out", reportPath], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(report.stdout, new RegExp(`Report written: ${escapeRegExp(reportPath)}`));
  const reportHtml = await readFile(path.join(projectRoot, reportPath), "utf8");
  assert.match(reportHtml, /id="summary"/);
  assert.match(reportHtml, /id="eval"/);
  assert.match(reportHtml, /id="trace"/);

  const claims = JSON.parse(await readFile(path.join(absoluteRunDir, "claims.json"), "utf8")) as ClaimsArtifact;
  const evidence = JSON.parse(await readFile(path.join(absoluteRunDir, "evidence.json"), "utf8")) as EvidenceArtifact;
  const claimId = claims.claims[0].id;
  const evidenceId = evidence.evidence[0].id;

  const reviewInit = await execFileAsync(process.execPath, [cliPath, "review", "init", runDir], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(reviewInit.stdout, /Review initialized:/);

  const claimReview = await execFileAsync(
    process.execPath,
    [cliPath, "review", "claim", runDir, claimId, "--status", "approved", "--reviewer", "e2e", "--rationale", "Primary claim is evidence-backed."],
    { cwd: projectRoot, env: deterministicEnv }
  );
  assert.match(claimReview.stdout, /Review action recorded: R1/);

  const evidenceReview = await execFileAsync(
    process.execPath,
    [cliPath, "review", "evidence", runDir, evidenceId, "--reviewer", "e2e", "--note", "Evidence citation and excerpt were checked."],
    { cwd: projectRoot, env: deterministicEnv }
  );
  assert.match(evidenceReview.stdout, /Review action recorded: R2/);

  const review = JSON.parse(await readFile(path.join(absoluteRunDir, "review.json"), "utf8")) as ReviewArtifact;
  assert.deepEqual(review.summary.approved_claims, [claimId]);
  assert.deepEqual(review.summary.evidence_annotations, [{ evidence_id: evidenceId, note_count: 1 }]);

  const reviewedMemo = await execFileAsync(process.execPath, [cliPath, "review", "export", runDir], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(reviewedMemo.stdout, /Reviewed memo written:/);
  const reviewedMemoText = await readFile(path.join(absoluteRunDir, "reviewed_memo.md"), "utf8");
  assert.match(reviewedMemoText, /## Human Review Summary/);
  assert.match(reviewedMemoText, new RegExp(`Approved claims: ${escapeRegExp(claimId)}`));

  const replayCheck = await execFileAsync(process.execPath, [cliPath, "replay", "--check", runDir], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(replayCheck.stdout, /Replay compatibility: pass/);

  const diff = await execFileAsync(process.execPath, [cliPath, "diff", runDir, runDir], {
    cwd: projectRoot,
    env: deterministicEnv
  });
  assert.match(diff.stdout, /Comparable: yes/);
  assert.match(diff.stdout, /Differences: 0/);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
