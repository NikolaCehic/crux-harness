#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { Command } from "commander";
import { createCruxApiServer } from "./api.js";
import { runBenchmark, writeBenchmarkReport } from "./benchmark.js";
import { checkReplayCompatibility, compareRuns, formatReplayCompatibility, formatRunComparison } from "./contracts.js";
import { inspectRun } from "./inspect.js";
import { formatMarketplaceList, formatMarketplaceVerification, installLocalPack, loadMarketplace, verifyMarketplace } from "./marketplace.js";
import { formatPackInspection, formatPackList, loadPack, loadPacks } from "./packs.js";
import { replayRun, rerunEvaluation, runHarness } from "./pipeline.js";
import { runQuery, type QueryRunOptions, type QueryRunResult } from "./query-intake.js";
import { addClaimReview, addEvidenceAnnotation, exportReviewedMemo, initReview } from "./review.js";
import { writeRunReport } from "./run-report.js";
import { importSources } from "./source-importer.js";
import type { EvalReport } from "./types.js";

const program = new Command();

program
  .name("crux")
  .description("Spec-driven harness for decision-grade analysis agents.")
  .version("1.12.0");

program
  .command("run")
  .argument("<input>", "Path to an input YAML file")
  .description("Run the Crux v1 pipeline")
  .action(async (input: string) => {
    const result = await runHarness(process.cwd(), input);
    console.log(`Run complete: ${path.relative(process.cwd(), result.runDir)}`);
  });

program
  .command("query")
  .argument("<question>", "Raw arbitrary question to normalize and run")
  .option("--context <text>", "Decision or analysis context")
  .option("--time-horizon <text>", "Time horizon for the analysis")
  .option("--output-goal <text>", "Output goal for the generated run", "decision memo")
  .option("--source-policy <policy>", "Source policy for the generated run", "hybrid")
  .description("Normalize a raw arbitrary query and run the Crux pipeline")
  .action(async (question: string, options: { context?: string; timeHorizon?: string; outputGoal?: string; sourcePolicy?: string }) => {
    await runAndPrintQuery(question, {
      context: options.context,
      timeHorizon: options.timeHorizon,
      outputGoal: options.outputGoal,
      sourcePolicy: options.sourcePolicy
    });
  });

program
  .command("ask")
  .argument("[question...]", "Raw arbitrary question. If omitted, Crux prompts interactively.")
  .option("--context <text>", "Decision or analysis context")
  .option("--time-horizon <text>", "Time horizon for the analysis")
  .option("--output-goal <text>", "Output goal for the generated run", "decision memo")
  .option("--source-policy <policy>", "Source policy for the generated run", "hybrid")
  .description("Ask Crux an arbitrary question and get an auditable run")
  .action(async (questionParts: string[] | undefined, options: { context?: string; timeHorizon?: string; outputGoal?: string; sourcePolicy?: string }) => {
    const question = (questionParts ?? []).join(" ").trim() || await promptForQuestion();
    await runAndPrintQuery(question, {
      context: options.context,
      timeHorizon: options.timeHorizon,
      outputGoal: options.outputGoal,
      sourcePolicy: options.sourcePolicy
    });
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
  .command("api")
  .option("--host <host>", "Host", "127.0.0.1")
  .option("--port <port>", "Port", "4317")
  .description("Start the local Crux API server")
  .action(async (options: { host: string; port: string }) => {
    const port = Number.parseInt(options.port, 10);
    if (Number.isNaN(port) || port < 0) {
      throw new Error("--port must be a non-negative integer");
    }

    const server = createCruxApiServer(process.cwd());
    server.listen(port, options.host, () => {
      console.log(`Crux API listening on http://${options.host}:${port}`);
    });
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

const review = program
  .command("review")
  .description("Human review utilities for a Crux run");

review
  .command("init")
  .argument("<runDir>", "Path to a run directory")
  .description("Create review.json if it does not exist")
  .action(async (runDir: string) => {
    await initReview(process.cwd(), runDir);
    console.log(`Review initialized: ${path.join(runDir, "review.json")}`);
  });

review
  .command("claim")
  .argument("<runDir>", "Path to a run directory")
  .argument("<claimId>", "Claim ID to review")
  .requiredOption("--status <status>", "approved or rejected")
  .requiredOption("--reviewer <name>", "Reviewer name")
  .requiredOption("--rationale <text>", "Review rationale")
  .description("Approve or reject a claim")
  .action(async (runDir: string, claimId: string, options: { status: string; reviewer: string; rationale: string }) => {
    if (options.status !== "approved" && options.status !== "rejected") {
      throw new Error("--status must be approved or rejected");
    }

    const action = await addClaimReview(process.cwd(), runDir, {
      claimId,
      status: options.status,
      reviewer: options.reviewer,
      rationale: options.rationale
    });
    console.log(`Review action recorded: ${action.id}`);
  });

review
  .command("evidence")
  .argument("<runDir>", "Path to a run directory")
  .argument("<evidenceId>", "Evidence ID to annotate")
  .requiredOption("--reviewer <name>", "Reviewer name")
  .requiredOption("--note <text>", "Evidence note")
  .description("Annotate an evidence item")
  .action(async (runDir: string, evidenceId: string, options: { reviewer: string; note: string }) => {
    const action = await addEvidenceAnnotation(process.cwd(), runDir, {
      evidenceId,
      reviewer: options.reviewer,
      note: options.note
    });
    console.log(`Review action recorded: ${action.id}`);
  });

review
  .command("export")
  .argument("<runDir>", "Path to a run directory")
  .option("--out <file>", "Reviewed memo path. Defaults to <runDir>/reviewed_memo.md")
  .description("Export a reviewed memo that preserves human review context")
  .action(async (runDir: string, options: { out?: string }) => {
    const output = await exportReviewedMemo(process.cwd(), runDir, options.out);
    console.log(`Reviewed memo written: ${output}`);
  });

const packs = program
  .command("packs")
  .description("Vertical pack utilities");

packs
  .command("list")
  .description("List available vertical packs")
  .action(async () => {
    console.log(formatPackList(await loadPacks(process.cwd())));
  });

packs
  .command("inspect")
  .argument("<packName>", "Pack name")
  .description("Inspect a vertical pack manifest")
  .action(async (packName: string) => {
    console.log(formatPackInspection(await loadPack(process.cwd(), path.join("packs", packName, "pack.json"))));
  });

const marketplace = program
  .command("marketplace")
  .description("Local marketplace registry utilities");

marketplace
  .command("list")
  .description("List local marketplace entries")
  .action(async () => {
    console.log(formatMarketplaceList(await loadMarketplace(process.cwd())));
  });

marketplace
  .command("verify")
  .description("Verify local marketplace compatibility")
  .action(async () => {
    const report = await verifyMarketplace(process.cwd());
    console.log(formatMarketplaceVerification(report));
    if (!report.compatible) {
      process.exitCode = 1;
    }
  });

marketplace
  .command("install")
  .argument("<packPath>", "Path to a local pack.json")
  .option("--to <packsDir>", "Target packs directory", "packs")
  .description("Install a local pack into a packs directory")
  .action(async (packPath: string, options: { to: string }) => {
    const pack = await installLocalPack(process.cwd(), packPath, options.to);
    console.log(`Installed pack: ${pack.name}`);
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

async function runAndPrintQuery(question: string, options: QueryRunOptions): Promise<void> {
  const result = await runQuery(process.cwd(), question, options);
  const reportPath = await writeRunReport(process.cwd(), result.runDir);
  const [memo, evalReport] = await Promise.all([
    readFile(path.join(result.runDir, "decision_memo.md"), "utf8"),
    readJson<EvalReport>(path.join(result.runDir, "eval_report.json"))
  ]);
  printQueryRunSummary(result, reportPath, memo, evalReport);
}

function printQueryRunSummary(result: QueryRunResult, reportPath: string, memo: string, evalReport: EvalReport): void {
  const runDir = path.relative(process.cwd(), result.runDir);
  const generatedInput = path.relative(process.cwd(), result.generatedInputPath);
  const queryIntake = path.join(runDir, "query_intake.json");
  const decisionMemo = path.join(runDir, "decision_memo.md");
  const blockingFailures = evalReport.council.synthesis.blocking_failures;

  console.log(`Query run complete: ${runDir}`);
  console.log(`Generated input: ${generatedInput}`);
  console.log(`Query intake: ${queryIntake}`);
  console.log(`Decision memo: ${decisionMemo}`);
  console.log(`HTML report: ${reportPath}`);
  console.log(`Trust gate: ${evalReport.council.synthesis.status} (${evalReport.council.synthesis.confidence})`);
  for (const failure of blockingFailures) {
    console.log(`Blocking issue: ${failure}`);
  }
  console.log(`Intent: ${result.intake.intent}`);
  console.log(`Scope: ${result.intake.analysis_scope}`);
  console.log(`Answerability: ${result.intake.answerability}`);
  console.log(`Risk: ${result.intake.risk_level}`);
  console.log("");
  console.log("Memo preview:");
  console.log(excerptMemo(memo));
  console.log("");
  console.log(`Open the memo: sed -n '1,220p' ${decisionMemo}`);
  console.log(`Inspect the run: npm run crux -- inspect ${runDir}`);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function excerptMemo(memo: string): string {
  const lines = memo.trim().split("\n");
  const nextTestsIndex = lines.findIndex((line) => line.trim() === "## Next Tests");
  const end = nextTestsIndex >= 0 ? Math.min(lines.length, nextTestsIndex + 7) : Math.min(lines.length, 80);
  return lines.slice(0, end).join("\n");
}

async function promptForQuestion(): Promise<string> {
  if (!process.stdin.isTTY) {
    throw new Error("Pass a question after `crux ask` or run it in an interactive terminal.");
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    const question = (await readline.question("Question: ")).trim();
    if (!question) {
      throw new Error("Question must not be empty.");
    }
    return question;
  } finally {
    readline.close();
  }
}
