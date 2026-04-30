import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { HARNESS_VERSION } from "./run-config.js";
import { loadPack } from "./packs.js";
import type { MarketplaceEntry, MarketplaceManifest, PackManifest } from "./types.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

export type MarketplaceEntryVerification = MarketplaceEntry & {
  compatible: boolean;
  issues: string[];
};

export type MarketplaceVerificationReport = {
  schema_version: "crux.marketplace.verification.v1";
  compatible: boolean;
  entries: MarketplaceEntryVerification[];
};

const currentArtifactVersions: Record<string, string> = {
  "eval_report.json": "1.2.0"
};

export async function loadMarketplace(projectRoot: string, marketplacePath = "marketplace/marketplace.json"): Promise<MarketplaceManifest> {
  const absoluteMarketplacePath = path.resolve(projectRoot, marketplacePath);
  const marketplace = JSON.parse(await readFile(absoluteMarketplacePath, "utf8")) as MarketplaceManifest;
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const result = await validator.validate(schemaIds.marketplace, marketplace);
  if (!result.valid) {
    throw new Error(`marketplace.schema.json validation failed for ${marketplacePath}: ${result.errors.join("; ")}`);
  }

  return marketplace;
}

export async function verifyMarketplace(projectRoot: string, marketplacePath = "marketplace/marketplace.json"): Promise<MarketplaceVerificationReport> {
  const marketplace = await loadMarketplace(projectRoot, marketplacePath);
  const entries = await Promise.all(marketplace.entries.map((entry) => verifyEntry(projectRoot, entry)));

  return {
    schema_version: "crux.marketplace.verification.v1",
    compatible: entries.every((entry) => entry.compatible),
    entries
  };
}

export async function installLocalPack(projectRoot: string, packPath: string, targetPacksDir = "packs"): Promise<PackManifest> {
  const pack = await loadPack(projectRoot, packPath);
  const targetDir = path.resolve(projectRoot, targetPacksDir, pack.name);
  await mkdir(targetDir, { recursive: true });
  await copyFile(path.resolve(projectRoot, packPath), path.join(targetDir, "pack.json"));
  return pack;
}

export function formatMarketplaceList(marketplace: MarketplaceManifest): string {
  return [
    "Marketplace:",
    ...marketplace.entries.map((entry) => {
      return `- ${entry.name}: ${entry.display_name} (${entry.kind}, ${entry.certification.status})`;
    })
  ].join("\n");
}

export function formatMarketplaceVerification(report: MarketplaceVerificationReport): string {
  const lines = [
    `Marketplace compatible: ${report.compatible ? "yes" : "no"}`
  ];

  for (const entry of report.entries) {
    lines.push(`- ${entry.name}: ${entry.compatible ? "compatible" : "incompatible"} (${entry.certification.status})`);
    for (const issue of entry.issues) {
      lines.push(`  - ${issue}`);
    }
  }

  return lines.join("\n");
}

async function verifyEntry(projectRoot: string, entry: MarketplaceEntry): Promise<MarketplaceEntryVerification> {
  const issues: string[] = [];
  const currentMajor = Number.parseInt(HARNESS_VERSION.split(".")[0], 10);

  if (entry.compatibility.harness_major !== currentMajor) {
    issues.push(`Harness major mismatch: entry requires ${entry.compatibility.harness_major}, current is ${currentMajor}.`);
  }

  for (const [artifactName, expectedVersion] of Object.entries(entry.compatibility.artifact_versions)) {
    const currentVersion = currentArtifactVersions[artifactName];
    if (!currentVersion) {
      issues.push(`Unknown artifact in compatibility declaration: ${artifactName}.`);
    } else if (currentVersion !== expectedVersion) {
      issues.push(`${artifactName} version mismatch: entry requires ${expectedVersion}, current is ${currentVersion}.`);
    }
  }

  if (entry.kind === "vertical_pack") {
    try {
      const pack = await loadPack(projectRoot, entry.source.path);
      if (pack.name !== entry.name) {
        issues.push(`Pack name mismatch: marketplace entry ${entry.name}, pack manifest ${pack.name}.`);
      }
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    ...entry,
    compatible: issues.length === 0,
    issues
  };
}
