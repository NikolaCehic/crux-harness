import { mkdir, readFile, rm, symlink, writeFile, copyFile, lstat } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeJson(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeText(filePath: string, value: string): Promise<void> {
  await writeFile(filePath, value.endsWith("\n") ? value : `${value}\n`, "utf8");
}

export async function copyIntoRun(inputPath: string, runDir: string): Promise<string> {
  const target = path.join(runDir, "input.yaml");
  await copyFile(inputPath, target);
  return target;
}

export async function updateLatestSymlink(runsDir: string, runId: string): Promise<void> {
  const latestPath = path.join(runsDir, "latest");
  try {
    await lstat(latestPath);
    await rm(latestPath, { recursive: true, force: true });
  } catch {
    // No existing latest pointer.
  }

  await symlink(runId, latestPath, "dir");
}

export function artifactPath(runDir: string, name: string): string {
  return path.join(runDir, name);
}

