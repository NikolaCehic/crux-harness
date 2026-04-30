import {
  buildContradictions,
  buildDecisionMemo,
  buildEvidence,
  buildPlaceholderEvidence,
  buildQuestionSpec,
  buildRedTeam,
  buildUncertainty
} from "../artifacts.js";
import { buildDeterministicClaims, decomposeClaimsWithLlm } from "../claim-decomposer.js";
import { mapEvidenceWithLlm } from "../evidence-mapper.js";
import { evaluateRun } from "../evaluator.js";
import { buildSourceChunks, buildSourceInventory } from "../sources.js";
import type {
  ClaimsArtifact,
  ContradictionsArtifact,
  EvalReport,
  EvidenceArtifact,
  QuestionSpec,
  SourceChunksArtifact,
  SourceInventory,
  UncertaintyArtifact
} from "../types.js";
import type { StageAdapter, StageModuleRegistry } from "./types.js";

export type IngestSourcesOutput = {
  sourceInventory: SourceInventory;
  sourceChunks: SourceChunksArtifact;
};

export type BuildClaimGraphInput = {
  sourceInventory: SourceInventory;
  sourceChunks: SourceChunksArtifact;
};

export type GatherEvidenceInput = {
  claims: ClaimsArtifact;
  sourceInventory: SourceInventory;
  sourceChunks: SourceChunksArtifact;
};

export type StageAdapters = {
  normalizeQuestion: StageAdapter<undefined, QuestionSpec>;
  ingestSources: StageAdapter<undefined, IngestSourcesOutput>;
  buildClaimGraph: StageAdapter<BuildClaimGraphInput, ClaimsArtifact>;
  gatherEvidence: StageAdapter<GatherEvidenceInput, EvidenceArtifact>;
  verifyClaims: StageAdapter<{ claims: ClaimsArtifact; evidence: EvidenceArtifact }, ContradictionsArtifact>;
  redTeam: StageAdapter<{ claims: ClaimsArtifact; evidence: EvidenceArtifact; contradictions: ContradictionsArtifact }, string>;
  modelUncertainty: StageAdapter<{ claims: ClaimsArtifact; evidence: EvidenceArtifact; contradictions: ContradictionsArtifact; redTeam: string }, UncertaintyArtifact>;
  writeDecisionMemo: StageAdapter<{ claims: ClaimsArtifact; evidence: EvidenceArtifact; contradictions: ContradictionsArtifact; redTeam: string; uncertainty: UncertaintyArtifact }, string>;
  evaluate: StageAdapter<undefined, EvalReport>;
};

export function createStageAdapters(registry: StageModuleRegistry): StageAdapters {
  return {
    normalizeQuestion: {
      ...registry.get("normalize_question"),
      run: async (_input, context) => buildQuestionSpec(context.input)
    },
    ingestSources: {
      ...registry.get("ingest_sources"),
      run: async (_input, context) => {
        const sourceInventory = await buildSourceInventory(context.projectRoot, context.input);
        const sourceChunks = await buildSourceChunks(context.projectRoot, sourceInventory);
        return { sourceInventory, sourceChunks };
      }
    },
    buildClaimGraph: {
      ...registry.get("build_claim_graph"),
      run: async (_input, context) => {
        if (registry.get("build_claim_graph").kind === "llm" && context.llm) {
          return decomposeClaimsWithLlm({ input: context.input, llm: context.llm, projectRoot: context.projectRoot });
        }

        return buildDeterministicClaims(context.input);
      }
    },
    gatherEvidence: {
      ...registry.get("gather_evidence"),
      run: async (input, context) => {
        if (registry.get("gather_evidence").kind === "llm" && context.llm && input.sourceInventory.sources.length > 0) {
          return mapEvidenceWithLlm({
            input: context.input,
            claims: input.claims,
            sourceInventory: input.sourceInventory,
            sourceChunks: input.sourceChunks,
            llm: context.llm,
            projectRoot: context.projectRoot
          });
        }

        return input.sourceInventory.sources.length > 0
          ? buildEvidence(context.input, input.sourceInventory, input.sourceChunks)
          : buildPlaceholderEvidence(context.input);
      }
    },
    verifyClaims: {
      ...registry.get("verify_claims"),
      run: async (_input, context) => buildContradictions(context.input)
    },
    redTeam: {
      ...registry.get("red_team"),
      run: async (_input, context) => buildRedTeam(context.input)
    },
    modelUncertainty: {
      ...registry.get("model_uncertainty"),
      run: async (_input, context) => buildUncertainty(context.input)
    },
    writeDecisionMemo: {
      ...registry.get("write_decision_memo"),
      run: async (_input, context) => buildDecisionMemo(context.input)
    },
    evaluate: {
      ...registry.get("evaluate"),
      run: async (_input, context) => evaluateRun(context.projectRoot, context.runDir)
    }
  };
}
