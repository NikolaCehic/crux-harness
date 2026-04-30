import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { runBenchmark } from "../src/benchmark.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const cliPath = "dist/src/cli.js";
const deterministicEnv = {
  ...process.env,
  CRUX_EVIDENCE_MAPPER: "deterministic",
  CRUX_LLM_PROVIDER: "",
  CRUX_LLM_API_KEY: ""
};

process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("benchmark runner passes all scoped scenarios", async () => {
  const report = await runBenchmark(projectRoot);

  assert.equal(report.schema_version, "crux.benchmark.report.v1");
  assert.equal(report.summary.scenario_count, 7);
  assert.equal(report.summary.regression_count, 0);
  assert.equal(report.passed, true);
  assert.deepEqual(
    report.results.map((result) => [result.scenario, result.passed, result.failures]),
    report.results.map((result) => [result.scenario, true, []])
  );
});

test("benchmark runner compares against the committed baseline", async () => {
  const report = await runBenchmark(projectRoot, {
    baselinePath: "e2e/baselines/current.json",
    regressionThreshold: 0.02
  });

  assert.equal(report.passed, true);
  assert.equal(report.baseline?.path, "e2e/baselines/current.json");
  assert.equal(report.summary.regression_count, 0);
  assert.equal(report.results.every((result) => result.regressions.length === 0), true);
});

test("compiled CLI runs the full benchmark suite as a black-box command", async () => {
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "benchmark"], { cwd: projectRoot, env: deterministicEnv });

  assert.match(stdout, /PASS investment-diligence/);
  assert.match(stdout, /PASS policy-analysis/);
  assert.match(stdout, /PASS product-strategy/);
  assert.match(stdout, /PASS scientific-thesis/);
  assert.match(stdout, /PASS market-entry/);
  assert.match(stdout, /PASS root-cause-analysis/);
  assert.match(stdout, /PASS strategic-tech/);
  assert.match(stdout, /Benchmark passed: 7\/7 scenarios, 0 regressions/);
});

test("compiled CLI writes a machine-readable benchmark report", async () => {
  const reportPath = `test-results/benchmark-e2e-${process.pid}-${Date.now()}.json`;
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "benchmark", "--report", reportPath], { cwd: projectRoot, env: deterministicEnv });
  assert.match(stdout, new RegExp(`Report written: ${reportPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));

  const report = JSON.parse(await readFile(path.join(projectRoot, reportPath), "utf8"));
  assert.equal(report.schema_version, "crux.benchmark.report.v1");
  assert.equal(report.summary.scenario_count, 7);
  assert.equal(report.summary.regression_count, 0);
  assert.equal(report.passed, true);
  assert.equal(report.results.length, 7);
  assert.equal(typeof report.results[0].scores.schema_validity, "number");
});

test("benchmark runner fails when a baseline score regresses past the threshold", async () => {
  const baselinePath = `test-results/high-baseline-${process.pid}-${Date.now()}.json`;
  await mkdir(path.dirname(path.join(projectRoot, baselinePath)), { recursive: true });
  await writeFile(
    path.join(projectRoot, baselinePath),
    JSON.stringify({
      schema_version: "crux.benchmark.baseline.v1",
      scenarios: Object.fromEntries(
        [
          "investment-diligence",
          "market-entry",
          "policy-analysis",
          "product-strategy",
          "root-cause-analysis",
          "scientific-thesis",
          "strategic-tech"
        ].map((scenario) => [
          scenario,
          {
            scores: { source_quality: 0.9 },
            artifact_counts: { claims: 12, evidence: 8, contradictions: 3 }
          }
        ])
      )
    }, null, 2),
    "utf8"
  );

  const report = await runBenchmark(projectRoot, {
    baselinePath,
    regressionThreshold: 0
  });

  assert.equal(report.passed, false);
  assert.equal(report.summary.regression_count, 7);
  assert.equal(report.results.every((result) => result.regressions.some((regression) => regression.includes("source_quality regressed"))), true);
});

test("compiled CLI lifecycle supports run, eval, and replay", async () => {
  const run = await execFileAsync(process.execPath, [cliPath, "run", "e2e/scenarios/product-strategy.yaml"], { cwd: projectRoot, env: deterministicEnv });
  const runMatch = run.stdout.match(/Run complete: (.+)/);
  assert.ok(runMatch, "run command should print the run directory");
  const runDir = runMatch[1].trim();

  const evaluation = await execFileAsync(process.execPath, [cliPath, "eval", runDir], { cwd: projectRoot, env: deterministicEnv });
  assert.match(evaluation.stdout, /Eval complete:/);

  const replay = await execFileAsync(process.execPath, [cliPath, "replay", runDir], { cwd: projectRoot, env: deterministicEnv });
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
