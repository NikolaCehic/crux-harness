import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { HARNESS_VERSION } from "./run-config.js";
import type { RunConfig } from "./types.js";

export type ReplayCompatibilityReport = {
  schema_version: "crux.replay_compatibility.v1";
  compatible: boolean;
  run_dir: string;
  checked_against_harness_version: string;
  blocking_issues: string[];
  warnings: string[];
};

export type RunDifference = {
  category: "harness" | "input" | "source" | "budget" | "mapper" | "prompt" | "stage" | "artifact_contract";
  path: string;
  left: unknown;
  right: unknown;
  severity: "blocking" | "informational";
};

export type RunComparisonReport = {
  schema_version: "crux.run_comparison.v1";
  comparable: boolean;
  left_run_dir: string;
  right_run_dir: string;
  differences: RunDifference[];
  summary: {
    difference_count: number;
    blocking_difference_count: number;
  };
};

export async function checkReplayCompatibility(projectRoot: string, runDir: string): Promise<ReplayCompatibilityReport> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const runConfig = await readRunConfig(absoluteRunDir);
  const blockingIssues: string[] = [];
  const warnings: string[] = [];

  if (runConfig.harness_version !== HARNESS_VERSION) {
    warnings.push(`Run was created with harness ${runConfig.harness_version}; current harness is ${HARNESS_VERSION}.`);
  }

  const inputPath = path.join(absoluteRunDir, "input.yaml");
  const inputHash = createHash("sha256").update(await readFile(inputPath, "utf8")).digest("hex");
  if (inputHash !== runConfig.input.content_hash) {
    blockingIssues.push(`Copied input hash changed: run_config has ${runConfig.input.content_hash}, input.yaml has ${inputHash}.`);
  }

  if (runConfig.artifact_contract?.schema_version !== "crux.artifact_contract.v1") {
    blockingIssues.push("run_config.json is missing artifact contract metadata.");
  }

  for (const artifact of runConfig.artifact_contract?.artifacts ?? []) {
    if (!artifact.name || !artifact.version) {
      blockingIssues.push(`Artifact contract entry is incomplete: ${JSON.stringify(artifact)}.`);
    }
  }

  return {
    schema_version: "crux.replay_compatibility.v1",
    compatible: blockingIssues.length === 0,
    run_dir: path.relative(projectRoot, absoluteRunDir),
    checked_against_harness_version: HARNESS_VERSION,
    blocking_issues: blockingIssues,
    warnings
  };
}

export async function compareRuns(projectRoot: string, leftRunDir: string, rightRunDir: string): Promise<RunComparisonReport> {
  const leftAbsoluteRunDir = path.resolve(projectRoot, leftRunDir);
  const rightAbsoluteRunDir = path.resolve(projectRoot, rightRunDir);
  const left = await readRunConfig(leftAbsoluteRunDir);
  const right = await readRunConfig(rightAbsoluteRunDir);
  const differences = [
    ...compareValue("harness", "harness_version", left.harness_version, right.harness_version, "informational"),
    ...compareValue("input", "input.path", left.input.path, right.input.path, "blocking"),
    ...compareValue("input", "input.content_hash", left.input.content_hash, right.input.content_hash, "blocking"),
    ...compareValue("source", "source_policy", left.source_policy, right.source_policy, "blocking"),
    ...compareValue("source", "source_pack", left.source_pack, right.source_pack, "blocking"),
    ...compareObject("budget", "budgets", left.budgets, right.budgets, "blocking"),
    ...compareObject("mapper", "mappers.claim_decomposer", left.mappers.claim_decomposer, right.mappers.claim_decomposer, "blocking"),
    ...compareObject("mapper", "mappers.evidence_mapper", left.mappers.evidence_mapper, right.mappers.evidence_mapper, "blocking"),
    ...compareObject("prompt", "prompts", left.prompts, right.prompts, "blocking"),
    ...compareObject("artifact_contract", "artifact_contract", left.artifact_contract, right.artifact_contract, "blocking"),
    ...compareStages(left, right)
  ];

  return {
    schema_version: "crux.run_comparison.v1",
    comparable: differences.every((difference) => difference.severity !== "blocking"),
    left_run_dir: path.relative(projectRoot, leftAbsoluteRunDir),
    right_run_dir: path.relative(projectRoot, rightAbsoluteRunDir),
    differences,
    summary: {
      difference_count: differences.length,
      blocking_difference_count: differences.filter((difference) => difference.severity === "blocking").length
    }
  };
}

export function formatReplayCompatibility(report: ReplayCompatibilityReport): string {
  return [
    `Replay compatibility: ${report.compatible ? "pass" : "fail"}`,
    `Run: ${report.run_dir}`,
    `Current harness: ${report.checked_against_harness_version}`,
    ...report.blocking_issues.map((issue) => `Blocking: ${issue}`),
    ...report.warnings.map((warning) => `Warning: ${warning}`)
  ].join("\n");
}

export function formatRunComparison(report: RunComparisonReport): string {
  const lines = [
    `Comparable: ${report.comparable ? "yes" : "no"}`,
    `Left: ${report.left_run_dir}`,
    `Right: ${report.right_run_dir}`,
    `Differences: ${report.summary.difference_count}`
  ];

  for (const difference of report.differences) {
    lines.push(`- [${difference.category}] ${difference.path}: ${String(difference.left)} -> ${String(difference.right)} (${difference.severity})`);
  }

  return lines.join("\n");
}

async function readRunConfig(runDir: string): Promise<RunConfig> {
  return JSON.parse(await readFile(path.join(runDir, "run_config.json"), "utf8")) as RunConfig;
}

function compareStages(left: RunConfig, right: RunConfig): RunDifference[] {
  const differences: RunDifference[] = [];
  const leftStages = new Map(left.stages.map((stage) => [stage.stage, stage]));
  const rightStages = new Map(right.stages.map((stage) => [stage.stage, stage]));
  const stageNames = [...new Set([...leftStages.keys(), ...rightStages.keys()])].sort();

  for (const stageName of stageNames) {
    const leftStage = leftStages.get(stageName);
    const rightStage = rightStages.get(stageName);
    if (!leftStage || !rightStage) {
      differences.push({
        category: "stage",
        path: `stages.${stageName}`,
        left: leftStage ?? null,
        right: rightStage ?? null,
        severity: "blocking"
      });
      continue;
    }

    for (const key of ["module_id", "module_version", "kind", "prompt_version", "provider", "model", "timeout_ms", "max_retries"] as const) {
      differences.push(...compareValue("stage", `stages.${stageName}.${key}`, leftStage[key] ?? null, rightStage[key] ?? null, "blocking"));
    }
  }

  return differences;
}

function compareObject(category: RunDifference["category"], rootPath: string, left: unknown, right: unknown, severity: RunDifference["severity"]): RunDifference[] {
  const differences: RunDifference[] = [];
  const keys = [...new Set([...Object.keys(asRecord(left)), ...Object.keys(asRecord(right))])].sort();
  for (const key of keys) {
    differences.push(...compareValue(category, `${rootPath}.${key}`, asRecord(left)[key] ?? null, asRecord(right)[key] ?? null, severity));
  }

  return differences;
}

function compareValue(category: RunDifference["category"], pathName: string, left: unknown, right: unknown, severity: RunDifference["severity"]): RunDifference[] {
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return [];
  }

  return [{ category, path: pathName, left, right, severity }];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
