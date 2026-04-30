import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { PackManifest } from "./types.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

export type PackResolvableInput = {
  analysis_scope?: string;
};

export async function loadPack(projectRoot: string, packPath: string): Promise<PackManifest> {
  const absolutePackPath = path.resolve(projectRoot, packPath);
  const pack = JSON.parse(await readFile(absolutePackPath, "utf8")) as PackManifest;
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const result = await validator.validate(schemaIds.pack, pack);
  if (!result.valid) {
    throw new Error(`pack.schema.json validation failed for ${packPath}: ${result.errors.join("; ")}`);
  }

  return pack;
}

export async function loadPacks(projectRoot: string, packsDir = "packs"): Promise<PackManifest[]> {
  const absolutePacksDir = path.resolve(projectRoot, packsDir);
  const entries = await readdir(absolutePacksDir, { withFileTypes: true });
  const packPaths = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(packsDir, entry.name, "pack.json"))
    .sort();

  return Promise.all(packPaths.map((packPath) => loadPack(projectRoot, packPath)));
}

export async function resolvePackForInput(projectRoot: string, input: PackResolvableInput): Promise<PackManifest | undefined> {
  const scope = normalizeScope(input.analysis_scope ?? "");
  if (!scope || scope === "custom") {
    return undefined;
  }

  const packs = await loadPacks(projectRoot);
  return packs.find((pack) => pack.analysis_scope === scope || pack.name === scope);
}

export function formatPackList(packs: PackManifest[]): string {
  return [
    "Packs:",
    ...packs.map((pack) => `- ${pack.name}: ${pack.display_name} (${pack.version})`)
  ].join("\n");
}

export function formatPackInspection(pack: PackManifest): string {
  return [
    `Pack: ${pack.name}`,
    `Display: ${pack.display_name}`,
    `Version: ${pack.version}`,
    `Scope: ${pack.analysis_scope}`,
    `Description: ${pack.description}`,
    `Min sources: ${pack.source_requirements.min_sources}`,
    `Required source types: ${pack.source_requirements.required_source_types.join(", ")}`,
    `Claim taxonomy: ${pack.claim_taxonomy.join(", ")}`,
    `Expected evidence: ${pack.expected_evidence_types.join(", ")}`,
    "Known failure modes:",
    ...pack.known_failure_modes.map((failure) => `  - ${failure}`),
    "Minimum scores:",
    ...Object.entries(pack.eval_rubric.min_scores).map(([score, minimum]) => `  - ${score}: ${minimum}`)
  ].join("\n");
}

function normalizeScope(scope: string): string {
  return scope.toLowerCase().trim().replace(/_/g, "-");
}
