#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { runBenchmark } from "./benchmark.js";
import { replayRun, rerunEvaluation, runHarness } from "./pipeline.js";

const program = new Command();

program
  .name("crux")
  .description("Spec-driven harness for decision-grade analysis agents.")
  .version("0.1.0");

program
  .command("run")
  .argument("<input>", "Path to an input YAML file")
  .description("Run the deterministic Crux v0.1 pipeline")
  .action(async (input: string) => {
    const result = await runHarness(process.cwd(), input);
    console.log(`Run complete: ${path.relative(process.cwd(), result.runDir)}`);
  });

program
  .command("benchmark")
  .description("Run the scoped E2E benchmark scenarios")
  .option("--scenarios <dir>", "Scenario directory", "e2e/scenarios")
  .option("--expectations <dir>", "Expectation directory", "e2e/expectations")
  .action(async (options: { scenarios: string; expectations: string }) => {
    const report = await runBenchmark(process.cwd(), options.scenarios, options.expectations);
    for (const result of report.results) {
      const status = result.passed ? "PASS" : "FAIL";
      console.log(`${status} ${result.scenario}: ${result.runDir}`);
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
    }
    console.log(`Benchmark ${report.passed ? "passed" : "failed"}: ${report.results.filter((result) => result.passed).length}/${report.scenario_count} scenarios`);
    if (!report.passed) {
      process.exitCode = 1;
    }
  });

program
  .command("eval")
  .argument("<runDir>", "Path to a run directory")
  .description("Re-evaluate an existing run and write eval_report.json")
  .action(async (runDir: string) => {
    await rerunEvaluation(process.cwd(), runDir);
    console.log(`Eval complete: ${path.join(runDir, "eval_report.json")}`);
  });

program
  .command("replay")
  .argument("<runDir>", "Path to a previous run directory")
  .description("Replay a run using its copied input.yaml")
  .action(async (runDir: string) => {
    const result = await replayRun(process.cwd(), runDir);
    console.log(`Replay complete: ${path.relative(process.cwd(), result.runDir)}`);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
