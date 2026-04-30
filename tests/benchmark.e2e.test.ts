import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { runBenchmark } from "../src/benchmark.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const cliPath = "dist/src/cli.js";

test("benchmark runner passes all scoped scenarios", async () => {
  const report = await runBenchmark(projectRoot);

  assert.equal(report.scenario_count, 7);
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.results.map((result) => [result.scenario, result.passed, result.failures]),
    report.results.map((result) => [result.scenario, true, []])
  );
});

test("compiled CLI runs the full benchmark suite as a black-box command", async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "benchmark"], { cwd: projectRoot });

  assert.match(stdout, /PASS investment-diligence/);
  assert.match(stdout, /PASS policy-analysis/);
  assert.match(stdout, /PASS product-strategy/);
  assert.match(stdout, /PASS scientific-thesis/);
  assert.match(stdout, /PASS market-entry/);
  assert.match(stdout, /PASS root-cause-analysis/);
  assert.match(stdout, /PASS strategic-tech/);
  assert.match(stdout, /Benchmark passed: 7\/7 scenarios/);
});

test("compiled CLI lifecycle supports run, eval, and replay", async () => {
  const run = await execFileAsync(process.execPath, [cliPath, "run", "e2e/scenarios/product-strategy.yaml"], { cwd: projectRoot });
  const runMatch = run.stdout.match(/Run complete: (.+)/);
  assert.ok(runMatch, "run command should print the run directory");
  const runDir = runMatch[1].trim();

  const evaluation = await execFileAsync(process.execPath, [cliPath, "eval", runDir], { cwd: projectRoot });
  assert.match(evaluation.stdout, /Eval complete:/);

  const replay = await execFileAsync(process.execPath, [cliPath, "replay", runDir], { cwd: projectRoot });
  assert.match(replay.stdout, /Replay complete:/);
});

test("compiled CLI fails loudly on invalid inputs", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [cliPath, "run", "e2e/bad-inputs/missing-question.yaml"], { cwd: projectRoot }),
    /missing required string field: question/
  );

  await assert.rejects(
    () => execFileAsync(process.execPath, [cliPath, "run", "e2e/bad-inputs/invalid-yaml.yaml"], { cwd: projectRoot }),
    /Missing closing "?quote|bad indentation|Flow sequence/
  );

  await assert.rejects(
    () => execFileAsync(process.execPath, [cliPath, "eval", "runs/does-not-exist"], { cwd: projectRoot }),
    /failed schema validation|Could not read|ENOENT/
  );
});
