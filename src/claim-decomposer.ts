import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildClaims } from "./artifacts.js";
import type { ClaimsArtifact, RunInput } from "./types.js";
import type { LlmClient } from "./llm.js";

export type ClaimDecomposerSelection = {
  type: "deterministic" | "llm";
  reason: string;
};

export type LlmClaimDecomposerInput = {
  input: RunInput;
  llm: LlmClient;
  projectRoot?: string;
};

export function selectClaimDecomposer(options: { env?: Record<string, string | undefined> }): ClaimDecomposerSelection {
  const env = options.env ?? process.env;
  if (env.CRUX_CLAIM_DECOMPOSER !== "llm") {
    return { type: "deterministic", reason: "CRUX_CLAIM_DECOMPOSER is not set to llm." };
  }

  if (!env.CRUX_LLM_PROVIDER) {
    return { type: "deterministic", reason: "CRUX_LLM_PROVIDER is not configured." };
  }

  if (env.CRUX_LLM_PROVIDER !== "openai-compatible") {
    return { type: "deterministic", reason: `Unsupported LLM provider: ${env.CRUX_LLM_PROVIDER}.` };
  }

  if (!env.CRUX_LLM_API_KEY) {
    return { type: "deterministic", reason: "CRUX_LLM_API_KEY is not configured." };
  }

  return { type: "llm", reason: "LLM claim decomposer requested and provider is configured." };
}

export async function decomposeClaimsWithLlm(options: LlmClaimDecomposerInput): Promise<ClaimsArtifact> {
  const prompt = await buildClaimDecomposerPrompt(options);
  const output = await options.llm.completeJson({
    system: "You decompose Crux analysis questions into atomic claim graphs and return strict JSON only.",
    prompt,
    metadata: {
      stage: "claim_decomposer",
      prompt_version: "claim-decomposer.v1",
      analysis_scope: options.input.analysis_scope ?? options.input.scenario_id ?? "unspecified"
    }
  });

  return parseClaimsOutput(output);
}

export function buildDeterministicClaims(input: RunInput): ClaimsArtifact {
  return buildClaims(input);
}

async function buildClaimDecomposerPrompt(options: LlmClaimDecomposerInput): Promise<string> {
  const template = await readFile(path.join(options.projectRoot ?? process.cwd(), "prompts", "claim-decomposer.md"), "utf8");
  return [
    template,
    "",
    "## Input",
    JSON.stringify(options.input, null, 2)
  ].join("\n");
}

function parseClaimsOutput(output: unknown): ClaimsArtifact {
  if (!isObject(output) || !Array.isArray(output.claims) || !Array.isArray(output.edges) || !Array.isArray(output.root_claim_ids)) {
    throw new Error("LLM claim decomposer output must include claims, edges, and root_claim_ids arrays.");
  }

  const artifact = output as ClaimsArtifact;
  const claimIds = new Set<string>();
  for (const [index, claim] of artifact.claims.entries()) {
    if (!isObject(claim)) {
      throw new Error(`LLM claim at index ${index} must be an object.`);
    }
    requireString(claim, "id", index);
    requireString(claim, "text", index);
    requireString(claim, "type", index);
    requireString(claim, "status", index);
    requireNumber(claim, "importance", index);
    requireNumber(claim, "confidence", index);
    requireStringArray(claim, "depends_on", index);
    requireStringArray(claim, "evidence_ids", index);
    requireStringArray(claim, "counterevidence_ids", index);
    requireString(claim, "notes", index);
    claimIds.add(claim.id);
  }

  for (const edge of artifact.edges) {
    if (!claimIds.has(edge.from) || !claimIds.has(edge.to)) {
      throw new Error(`LLM claim decomposer output references unknown edge endpoint: ${edge.from} -> ${edge.to}.`);
    }
  }

  for (const rootClaimId of artifact.root_claim_ids) {
    if (!claimIds.has(rootClaimId)) {
      throw new Error(`LLM claim decomposer output references unknown root claim: ${rootClaimId}.`);
    }
  }

  return artifact;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(item: Record<string, unknown>, key: string, index: number): void {
  if (typeof item[key] !== "string" || item[key] === "") {
    throw new Error(`LLM claim item ${index} missing required string field ${key}.`);
  }
}

function requireNumber(item: Record<string, unknown>, key: string, index: number): void {
  if (typeof item[key] !== "number") {
    throw new Error(`LLM claim item ${index} missing required number field ${key}.`);
  }
}

function requireStringArray(item: Record<string, unknown>, key: string, index: number): void {
  const value = item[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`LLM claim item ${index} missing required string array field ${key}.`);
  }
}
