import { readFile } from "node:fs/promises";
import path from "node:path";
import { runHarness, type RunResult } from "./pipeline.js";
import type { EvalReport } from "./types.js";

export type CruxLocalSdkOptions = {
  projectRoot: string;
};

export class CruxLocalSdk {
  constructor(private readonly options: CruxLocalSdkOptions) {}

  async createRun(inputPath: string): Promise<{ run_id: string; run_dir: string }> {
    const run = await runHarness(this.options.projectRoot, inputPath);
    return toSdkRun(this.options.projectRoot, run);
  }

  async getEvalReport(runDir: string): Promise<EvalReport> {
    return this.getArtifact<EvalReport>(runDir, "eval_report.json");
  }

  async getArtifact<T = unknown>(runDir: string, artifactName: string): Promise<T> {
    if (!isSafeArtifactName(artifactName)) {
      throw new Error(`Artifact name must be a file name inside the run directory: ${artifactName}`);
    }

    return JSON.parse(await readFile(path.join(resolveRunDir(this.options.projectRoot, runDir), artifactName), "utf8")) as T;
  }
}

function toSdkRun(projectRoot: string, run: RunResult): { run_id: string; run_dir: string } {
  return {
    run_id: run.runId,
    run_dir: path.relative(projectRoot, run.runDir)
  };
}

function resolveRunDir(projectRoot: string, runDir: string): string {
  return path.resolve(projectRoot, runDir);
}

function isSafeArtifactName(value: string): boolean {
  return path.basename(value) === value && !value.includes("..") && value.length > 0;
}
