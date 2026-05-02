import type { ClaimDecomposerSelection } from "../claim-decomposer.js";
import type { EvidenceMapperSelection } from "../llm.js";
import { stageNames, type StageModule, type StageModuleRegistry, type StageName } from "./types.js";

export type CreateStageModuleRegistryInput = {
  claimDecomposer: ClaimDecomposerSelection;
  evidenceMapper: EvidenceMapperSelection;
  llmConfigured: boolean;
  provider?: string;
  model?: string;
};

const deterministicVersion = "1.0.0";
const defaultTimeoutMs = 30_000;
const defaultRetries = 0;

export function createStageModuleRegistry(input: CreateStageModuleRegistryInput): StageModuleRegistry {
  const modules = stageNames.map((stage): StageModule => {
    if (stage === "build_claim_graph" && input.claimDecomposer.type === "llm" && input.llmConfigured) {
      return llmModule(stage, "llm.claim-decomposer", "claim-decomposer.v1", input);
    }

    if (stage === "gather_evidence" && input.evidenceMapper.type === "llm" && input.llmConfigured) {
      return llmModule(stage, "llm.evidence-mapper", "evidence-mapper.v1", input);
    }

    return deterministicModule(stage);
  });

  return {
    modules,
    get(stage: StageName): StageModule {
      const module = modules.find((entry) => entry.stage === stage);
      if (!module) {
        throw new Error(`No stage module registered for ${stage}`);
      }

      return module;
    }
  };
}

function deterministicModule(stage: StageName): StageModule {
  return {
    stage,
    module_id: deterministicModuleId(stage),
    module_version: deterministicVersion,
    kind: "deterministic",
    timeout_ms: defaultTimeoutMs,
    max_retries: defaultRetries
  };
}

function llmModule(
  stage: StageName,
  moduleId: string,
  promptVersion: string,
  input: CreateStageModuleRegistryInput
): StageModule {
  return {
    stage,
    module_id: moduleId,
    module_version: "1.0.0",
    kind: "llm",
    prompt_version: promptVersion,
    provider: input.provider,
    model: input.model,
    timeout_ms: 60_000,
    max_retries: 1
  };
}

function deterministicModuleId(stage: StageName): string {
  switch (stage) {
    case "normalize_question":
      return "deterministic.question-normalizer";
    case "ingest_sources":
      return "deterministic.source-ingester";
    case "build_claim_graph":
      return "deterministic.claim-decomposer";
    case "gather_evidence":
      return "deterministic.evidence-mapper";
    case "verify_claims":
      return "deterministic.claim-verifier";
    case "red_team":
      return "deterministic.red-team";
    case "model_uncertainty":
      return "deterministic.uncertainty-modeler";
    case "write_decision_memo":
      return "deterministic.memo-writer";
    case "run_agents":
      return "deterministic.bounded-agent-council";
    case "evaluate":
      return "deterministic.evaluator";
  }
}
