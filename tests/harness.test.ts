import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { replayRun, rerunEvaluation, runHarness } from "../src/pipeline.js";

const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";

test("runHarness creates a complete, schema-valid deterministic run", async () => {
  const result = await runHarness(projectRoot, exampleInput);

  for (const file of [
    "input.yaml",
    "question_spec.json",
    "claims.json",
    "evidence.json",
    "contradictions.json",
    "red_team.md",
    "uncertainty.json",
    "decision_memo.md",
    "eval_report.json",
    "trace.jsonl"
  ]) {
    assert.equal(existsSync(path.join(result.runDir, file)), true, `${file} should exist`);
  }

  const claims = JSON.parse(await readFile(path.join(result.runDir, "claims.json"), "utf8"));
  assert.equal(claims.claims.length, 12);
  assert.equal(claims.root_claim_ids.length, 3);

  const evidence = JSON.parse(await readFile(path.join(result.runDir, "evidence.json"), "utf8"));
  assert.equal(evidence.evidence.length, 8);

  const evalReport = JSON.parse(await readFile(path.join(result.runDir, "eval_report.json"), "utf8"));
  assert.equal(evalReport.scores.schema_validity, 1);
  assert.deepEqual(evalReport.failed_checks, []);

  const traceLines = readFileSync(path.join(result.runDir, "trace.jsonl"), "utf8").trim().split("\n");
  assert.equal(traceLines.length, 16);
});

test("rerunEvaluation rewrites eval_report.json for an existing run", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  await rerunEvaluation(projectRoot, path.relative(projectRoot, result.runDir));

  const evalReport = JSON.parse(await readFile(path.join(result.runDir, "eval_report.json"), "utf8"));
  assert.equal(evalReport.scores.schema_validity, 1);
  assert.equal(evalReport.failed_checks.length, 0);
});

test("replayRun creates a new run from a prior run input", async () => {
  const original = await runHarness(projectRoot, exampleInput);
  const replay = await replayRun(projectRoot, path.relative(projectRoot, original.runDir));

  assert.notEqual(replay.runDir, original.runDir);
  assert.equal(existsSync(path.join(replay.runDir, "decision_memo.md")), true);
});

