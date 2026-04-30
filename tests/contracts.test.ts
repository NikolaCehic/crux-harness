import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { compareRuns, checkReplayCompatibility } from "../src/contracts.js";
import { runHarness } from "../src/pipeline.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const cliPath = "dist/src/cli.js";

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("run_config records artifact contract versions", async () => {
  const result = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");
  const runConfig = JSON.parse(await readFile(path.join(result.runDir, "run_config.json"), "utf8"));

  assert.equal(runConfig.artifact_contract.schema_version, "crux.artifact_contract.v1");
  assert.equal(runConfig.artifact_contract.artifacts.some((artifact: { name: string; version: string }) => {
    return artifact.name === "claims.json" && artifact.version === "1.0.0";
  }), true);
  assert.equal(runConfig.artifact_contract.artifacts.some((artifact: { name: string; schema_id: string }) => {
    return artifact.name === "eval_report.json" && artifact.schema_id.includes("eval_report.schema.json");
  }), true);
});

test("checkReplayCompatibility accepts an unchanged run and rejects input hash drift", async () => {
  const result = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");
  const compatible = await checkReplayCompatibility(projectRoot, result.runDir);
  assert.equal(compatible.compatible, true);
  assert.deepEqual(compatible.blocking_issues, []);

  await writeFile(path.join(result.runDir, "input.yaml"), "question: drifted\n", "utf8");
  const drifted = await checkReplayCompatibility(projectRoot, result.runDir);
  assert.equal(drifted.compatible, false);
  assert.equal(drifted.blocking_issues.some((issue) => issue.includes("input hash")), true);
});

test("compareRuns ignores run identity but detects prompt drift", async () => {
  const left = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");
  const right = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");

  const same = await compareRuns(projectRoot, left.runDir, right.runDir);
  assert.equal(same.comparable, true);
  assert.equal(same.differences.length, 0);

  const runConfigPath = path.join(right.runDir, "run_config.json");
  const runConfig = JSON.parse(await readFile(runConfigPath, "utf8"));
  runConfig.prompts.evidence_mapper = "evidence-mapper.v2";
  await writeFile(runConfigPath, `${JSON.stringify(runConfig, null, 2)}\n`, "utf8");

  const changed = await compareRuns(projectRoot, left.runDir, right.runDir);
  assert.equal(changed.comparable, false);
  assert.equal(changed.differences.some((difference) => {
    return difference.category === "prompt" && difference.path === "prompts.evidence_mapper";
  }), true);
});

test("compiled CLI checks replay compatibility and prints run diffs", async () => {
  const left = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");
  const right = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");
  const runConfigPath = path.join(right.runDir, "run_config.json");
  const runConfig = JSON.parse(await readFile(runConfigPath, "utf8"));
  runConfig.stages[0].module_version = "9.9.9";
  await writeFile(runConfigPath, `${JSON.stringify(runConfig, null, 2)}\n`, "utf8");

  const replayCheck = await execFileAsync(process.execPath, [cliPath, "replay", "--check", path.relative(projectRoot, left.runDir)], { cwd: projectRoot });
  assert.match(replayCheck.stdout, /Replay compatibility: pass/);

  const diff = await execFileAsync(process.execPath, [cliPath, "diff", path.relative(projectRoot, left.runDir), path.relative(projectRoot, right.runDir)], { cwd: projectRoot });
  assert.match(diff.stdout, /Comparable: no/);
  assert.match(diff.stdout, /stage/);
  assert.match(diff.stdout, /stages.normalize_question.module_version/);
});
