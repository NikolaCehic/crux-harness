import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateRunIntegrity } from "./integrity.js";
import type { ClaimsArtifact, EvalReport, EvidenceArtifact, RunConfig, SourceChunksArtifact, SourceInventory } from "./types.js";

export async function inspectRun(projectRoot: string, runDir: string): Promise<string> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const [runConfig, claims, evidence, sourceInventory, sourceChunks, evalReport, integrity] = await Promise.all([
    readJson<RunConfig>(absoluteRunDir, "run_config.json"),
    readJson<ClaimsArtifact>(absoluteRunDir, "claims.json"),
    readJson<EvidenceArtifact>(absoluteRunDir, "evidence.json"),
    readJson<SourceInventory>(absoluteRunDir, "source_inventory.json"),
    readJson<SourceChunksArtifact>(absoluteRunDir, "source_chunks.json"),
    readJson<EvalReport>(absoluteRunDir, "eval_report.json"),
    validateRunIntegrity(projectRoot, absoluteRunDir)
  ]);

  const scenario = path.basename(runConfig.input.path).replace(/\.(yaml|yml)$/i, "");
  const scoreLines = Object.entries(evalReport.scores)
    .map(([name, value]) => `  ${name}: ${value}`)
    .join("\n");
  const councilReviewLines = evalReport.council.reviewers
    .map((reviewer) => `  ${reviewer.role_id}: ${reviewer.status} (${reviewer.score})`)
    .join("\n");

  return [
    `Crux Run: ${path.relative(projectRoot, absoluteRunDir)}`,
    `Scenario: ${scenario}`,
    `Harness: ${runConfig.harness_version}`,
    `Source policy: ${runConfig.source_policy}`,
    `Integrity: ${integrity.valid ? "pass" : "fail"}`,
    `Claims: ${claims.claims.length}`,
    `Evidence: ${evidence.evidence.length}`,
    `Sources: ${sourceInventory.sources.length}`,
    `Source chunks: ${sourceChunks.chunks.length}`,
    "Scores:",
    scoreLines,
    `Council: ${evalReport.council.synthesis.status} (${evalReport.council.synthesis.confidence})`,
    "Council reviewers:",
    councilReviewLines,
    ...(integrity.failures.length > 0 ? ["Failures:", ...integrity.failures.map((failure) => `  - ${failure}`)] : [])
  ].join("\n");
}

async function readJson<T>(runDir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
}
