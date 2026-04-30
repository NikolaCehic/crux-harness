import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimDecomposerSelection } from "./claim-decomposer.js";
import type { EvidenceMapperSelection } from "./llm.js";
import type { StageModule } from "./stages/types.js";
import type { RunConfig, RunInput } from "./types.js";
import { schemaIds } from "./validator.js";

export const HARNESS_VERSION = "1.8.0";

export type BuildRunConfigInput = {
  projectRoot: string;
  runId: string;
  inputPath: string;
  copiedInputPath: string;
  input: RunInput;
  claimDecomposer: ClaimDecomposerSelection;
  evidenceMapper: EvidenceMapperSelection;
  stages: StageModule[];
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
    artifact_contract: buildArtifactContract(),
    mappers: {
      claim_decomposer: options.claimDecomposer,
      evidence_mapper: options.evidenceMapper
    },
    stages: options.stages.map((stage) => ({
      stage: stage.stage,
      module_id: stage.module_id,
      module_version: stage.module_version,
      kind: stage.kind,
      ...(stage.prompt_version ? { prompt_version: stage.prompt_version } : {}),
      ...(stage.provider ? { provider: stage.provider } : {}),
      ...(stage.model ? { model: stage.model } : {}),
      timeout_ms: stage.timeout_ms,
      max_retries: stage.max_retries
    })),
    prompts: {
      claim_decomposer: "claim-decomposer.v1",
      evidence_mapper: "evidence-mapper.v1"
    }
  };
}

function buildArtifactContract(): RunConfig["artifact_contract"] {
  return {
    schema_version: "crux.artifact_contract.v1",
    artifacts: [
      artifact("input.yaml"),
      artifact("run_config.json", schemaIds.runConfig),
      artifact("question_spec.json", schemaIds.questionSpec),
      artifact("source_inventory.json", schemaIds.sourceInventory),
      artifact("source_chunks.json", schemaIds.sourceChunks),
      artifact("claims.json", schemaIds.claims),
      artifact("evidence.json", schemaIds.evidence),
      artifact("contradictions.json", schemaIds.contradictions),
      artifact("red_team.md"),
      artifact("uncertainty.json", schemaIds.uncertainty),
      artifact("decision_memo.md"),
      artifact("eval_report.json", schemaIds.evalReport, "1.2.0"),
      artifact("trace.jsonl")
    ]
  };
}

function artifact(name: string, schemaId?: string, version = "1.0.0"): RunConfig["artifact_contract"]["artifacts"][number] {
  return {
    name,
    version,
    ...(schemaId ? { schema_id: schemaId } : {}),
    required: true
  };
}

function sourcePackPath(input: RunInput): string | undefined {
  if (typeof input.source_pack === "string") {
    return input.source_pack;
  }

  return input.source_pack?.path;
}
