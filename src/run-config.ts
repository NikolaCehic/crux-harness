import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimDecomposerSelection } from "./claim-decomposer.js";
import type { EvidenceMapperSelection } from "./llm.js";
import type { RunConfig, RunInput } from "./types.js";

export const HARNESS_VERSION = "1.0.0";

export type BuildRunConfigInput = {
  projectRoot: string;
  runId: string;
  inputPath: string;
  copiedInputPath: string;
  input: RunInput;
  claimDecomposer: ClaimDecomposerSelection;
  evidenceMapper: EvidenceMapperSelection;
};

export async function buildRunConfig(options: BuildRunConfigInput): Promise<RunConfig> {
  const copiedInput = await readFile(options.copiedInputPath, "utf8");

  return {
    schema_version: "crux.run_config.v1",
    harness_version: HARNESS_VERSION,
    run_id: options.runId,
    created_at: new Date().toISOString(),
    input: {
      path: path.relative(options.projectRoot, options.inputPath),
      copied_path: path.relative(options.projectRoot, options.copiedInputPath),
      content_hash: createHash("sha256").update(copiedInput).digest("hex")
    },
    source_policy: options.input.source_policy ?? "offline",
    source_pack: sourcePackPath(options.input) ?? null,
    budgets: {
      max_research_items: options.input.tool_budget?.max_research_items ?? null,
      max_agent_steps: options.input.tool_budget?.max_agent_steps ?? null,
      max_llm_calls: options.input.model_budget?.max_llm_calls ?? null
    },
    mappers: {
      claim_decomposer: options.claimDecomposer,
      evidence_mapper: options.evidenceMapper
    },
    prompts: {
      claim_decomposer: "claim-decomposer.v1",
      evidence_mapper: "evidence-mapper.v1"
    }
  };
}

function sourcePackPath(input: RunInput): string | undefined {
  if (typeof input.source_pack === "string") {
    return input.source_pack;
  }

  return input.source_pack?.path;
}
