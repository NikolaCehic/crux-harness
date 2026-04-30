#!/usr/bin/env node
import path from "node:path";
import { Command } from "commander";
import { runBenchmark, writeBenchmarkReport } from "./benchmark.js";
import { checkReplayCompatibility, compareRuns, formatReplayCompatibility, formatRunComparison } from "./contracts.js";
import { inspectRun } from "./inspect.js";
import { replayRun, rerunEvaluation, runHarness } from "./pipeline.js";
import { writeRunReport } from "./run-report.js";
import { importSources } from "./source-importer.js";

const program = new Command();

program
  .name("crux")
  .description("Spec-driven harness for decision-grade analysis agents.")
  .version("1.5.0");

program
  .command("run")
  .argument("<input>", "Path to an input YAML file")
  .description("Run the Crux v1 pipeline")
  .action(async (input: string) => {
    const result = await runHarness(process.cwd(), input);
    console.log(`Run complete: ${path.relative(process.cwd(), result.runDir)}`);
  });

program
  .command("benchmark")
  .description("Run the scoped E2E benchmark scenarios")
  .option("--scenarios <dir>", "Scenario directory", "e2e/scenarios")
  .option("--expectations <dir>", "Expectation directory", "e2e/expectations")
  .option("--baseline <file>", "Baseline JSON file for regression comparison", "e2e/baselines/current.json")
  .option("--regression-threshold <number>", "Allowed score drop versus baseline", "0.02")
  .option("--report <file>", "Write machine-readable benchmark report JSON")
  .action(async (options: { scenarios: string; expectations: string; baseline?: string; regressionThreshold: string; report?: string }) => {
    const regressionThreshold = Number.parseFloat(options.regressionThreshold);
    if (Number.isNaN(regressionThreshold) || regressionThreshold < 0) {
      throw new Error("--regression-threshold must be a non-negative number");
    }

    const report = await runBenchmark(process.cwd(), {
      scenariosDir: options.scenarios,
      expectationsDir: options.expectations,
      baselinePath: options.baseline,
      regressionThreshold
    });

    for (const result of report.results) {
      const status = result.passed ? "PASS" : "FAIL";
      console.log(`${status} ${result.scenario}: ${result.runDir} (${result.duration_ms}ms)`);
      for (const failure of result.failures) {
        console.log(`  - ${failure}`);
      }
    }

    if (options.report) {
      await writeBenchmarkReport(path.resolve(process.cwd(), options.report), report);
      console.log(`Report written: ${options.report}`);
    }

    console.log(`Benchmark ${report.passed ? "passed" : "failed"}: ${report.summary.passed_count}/${report.summary.scenario_count} scenarios, ${report.summary.regression_count} regressions`);
    if (!report.passed) {
      process.exitCode = 1;
    }
  });

program
  .command("inspect")
  .argument("<runDir>", "Path to a run directory")
  .description("Print a compact summary of a Crux run")
  .action(async (runDir: string) => {
    console.log(await inspectRun(process.cwd(), runDir));
  });

program
  .command("report")
  .argument("<runDir>", "Path to a run directory")
  .option("--out <file>", "HTML report path. Defaults to <runDir>/run_report.html")
  .description("Write a static HTML inspector for a Crux run")
  .action(async (runDir: string, options: { out?: string }) => {
    const reportPath = await writeRunReport(process.cwd(), runDir, options.out);
    console.log(`Report written: ${reportPath}`);
  });

const sources = program
  .command("sources")
  .description("Source-pack utilities");

sources
  .command("import")
  .argument("<inputDir>", "Directory of raw source files")
  .requiredOption("--out <sourcePackDir>", "Directory where the generated source pack should be written")
  .description("Import raw files into a Crux source pack")
  .action(async (inputDir: string, options: { out: string }) => {
    const report = await importSources({
      inputDir: path.resolve(process.cwd(), inputDir),
      outputDir: path.resolve(process.cwd(), options.out)
    });

    console.log(`Imported ${report.imported_count} sources to ${path.relative(process.cwd(), report.output_dir)}`);
    for (const source of report.sources) {
      console.log(`  - ${source.id}: ${path.relative(process.cwd(), source.output_path)}`);
    }
    console.log(`Skipped ${report.skipped_count} files`);
    for (const skipped of report.skipped) {
      console.log(`  - ${path.relative(process.cwd(), skipped.path)} (${skipped.reason})`);
    }
  });

program
  .command("diff")
  .argument("<leftRunDir>", "Path to the first run directory")
  .argument("<rightRunDir>", "Path to the second run directory")
  .description("Compare two Crux runs for contract-level differences")
  .action(async (leftRunDir: string, rightRunDir: string) => {
    console.log(formatRunComparison(await compareRuns(process.cwd(), leftRunDir, rightRunDir)));
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
  .option("--check", "Check whether the run can be replayed without creating a new run")
  .description("Replay a run using its copied input.yaml")
  .action(async (runDir: string, options: { check?: boolean }) => {
    if (options.check) {
      const report = await checkReplayCompatibility(process.cwd(), runDir);
      console.log(formatReplayCompatibility(report));
      if (!report.compatible) {
        process.exitCode = 1;
      }
      return;
    }

    const result = await replayRun(process.cwd(), runDir);
    console.log(`Replay complete: ${path.relative(process.cwd(), result.runDir)}`);
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
