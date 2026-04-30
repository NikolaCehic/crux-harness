import path from "node:path";
import { parse } from "yaml";
import { readText } from "./fs.js";
import type { RunInput } from "./types.js";

export async function loadInput(inputPath: string): Promise<RunInput> {
  const raw = await readText(inputPath);
  const parsed = parse(raw) as Partial<RunInput> | null;

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Input file is empty or invalid: ${inputPath}`);
  }

  for (const field of ["question", "decision_context", "time_horizon", "output_goal"] as const) {
    if (typeof parsed[field] !== "string" || parsed[field]?.trim() === "") {
      throw new Error(`Input file is missing required string field: ${field}`);
    }
  }

  return parsed as RunInput;
}

export function slugFromInput(inputPath: string, question: string): string {
  const base = path.basename(inputPath).replace(/\.[^.]+$/, "");
  const text = isGeneratedQueryInput(inputPath, base) ? question : base || question;
  const slug = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);

  return slug || "analysis";
}

function isGeneratedQueryInput(inputPath: string, base: string): boolean {
  return path.basename(path.dirname(inputPath)) === "query-inputs" || /^\d{8}T\d{6}Z-/.test(base);
}
