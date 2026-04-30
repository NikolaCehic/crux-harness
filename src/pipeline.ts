import { mkdir } from "node:fs/promises";
import path from "node:path";
import { buildDeterministicClaims, selectClaimDecomposer } from "./claim-decomposer.js";
import { selectEvidenceMapper } from "./evidence-mapper.js";
import { evaluateRun } from "./evaluator.js";
import { artifactPath, copyIntoRun, ensureDir, updateLatestSymlink, writeJson, writeText } from "./fs.js";
import { loadInput, slugFromInput } from "./input.js";
import { createConfiguredLlmClient } from "./llm.js";
import { buildRunConfig } from "./run-config.js";
import { createStageAdapters } from "./stages/adapters.js";
import { createStageModuleRegistry } from "./stages/registry.js";
import { runStageModule } from "./stages/runtime.js";
import { stageModuleMetadata, type StageAdapter, type StageAdapterContext } from "./stages/types.js";
import { trace } from "./trace.js";
import type { ClaimsArtifact, RunContext, SourceChunksArtifact, SourceInventory } from "./types.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

export type RunResult = {
  runId: string;
  runDir: string;
};

export async function runHarness(projectRoot: string, inputPath: string): Promise<RunResult> {
  const absoluteInputPath = path.resolve(projectRoot, inputPath);
  const input = await loadInput(absoluteInputPath);
  const runsDir = path.join(projectRoot, "runs");
  const runId = await createRunId(runsDir, slugFromInput(absoluteInputPath, input.question));
  const runDir = path.join(runsDir, runId);
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));

  await ensureDir(runDir);
  const copiedInputPath = await copyIntoRun(absoluteInputPath, runDir);
  await writeText(path.join(runDir, "trace.jsonl"), "");
  const claimDecomposerSelection = selectClaimDecomposer({ env: process.env });
  const evidenceMapperSelection = selectEvidenceMapper({ env: process.env });
  const llm = createConfiguredLlmClient();
  const stageRegistry = createStageModuleRegistry({
    claimDecomposer: claimDecomposerSelection,
    evidenceMapper: evidenceMapperSelection,
    llmConfigured: Boolean(llm),
    provider: process.env.CRUX_LLM_PROVIDER,
    model: process.env.CRUX_LLM_MODEL ?? "gpt-4.1-mini"
  });
  const adapters = createStageAdapters(stageRegistry);
  const runConfig = await buildRunConfig({
    projectRoot,
    runId,
    inputPath: absoluteInputPath,
    copiedInputPath,
    input,
    claimDecomposer: claimDecomposerSelection,
    evidenceMapper: evidenceMapperSelection,
    stages: stageRegistry.modules
  });
  await validateOrThrow(validator, schemaIds.runConfig, runConfig);
  await writeJson(artifactPath(runDir, "run_config.json"), runConfig);

  const context: RunContext = {
    projectRoot,
    runDir,
    runId,
    inputPath: absoluteInputPath,
    input
  };
  const stageContext: StageAdapterContext = {
    projectRoot,
    runDir,
    input,
    ...(llm ? { llm } : {})
  };

  try {
    const questionSpec = await runStage(context, adapters.normalizeQuestion, ["input.yaml"], ["question_spec.json"], undefined, stageContext);
    await validateOrThrow(validator, schemaIds.questionSpec, questionSpec);
    await writeJson(artifactPath(runDir, "question_spec.json"), questionSpec);

    let sourceInventory: SourceInventory = {
      source_pack: {
        path: null,
        mode: "none"
      },
      sources: []
    };
    let sourceChunks: SourceChunksArtifact = {
      source_pack: {
        path: null,
        mode: "none"
      },
      chunks: []
    };
    let claimsArtifact: ClaimsArtifact = buildDeterministicClaims(input);
    const ingestedSources = await runStage(context, adapters.ingestSources, ["input.yaml"], ["source_inventory.json", "source_chunks.json"], undefined, stageContext);
    sourceInventory = ingestedSources.sourceInventory;
    sourceChunks = ingestedSources.sourceChunks;
    await validateOrThrow(validator, schemaIds.sourceInventory, sourceInventory);
    await validateOrThrow(validator, schemaIds.sourceChunks, sourceChunks);
    await writeJson(artifactPath(runDir, "source_inventory.json"), sourceInventory);
    await writeJson(artifactPath(runDir, "source_chunks.json"), sourceChunks);

    claimsArtifact = await runStage(
      context,
      adapters.buildClaimGraph,
      ["question_spec.json", "source_inventory.json", "source_chunks.json"],
      ["claims.json"],
      { sourceInventory, sourceChunks },
      stageContext
    );

    await trace(runDir, {
      stage: "build_claim_graph",
      event_type: "info",
      message: "Selected claim decomposer",
      input_artifacts: ["question_spec.json", "source_inventory.json", "source_chunks.json"],
      output_artifacts: ["claims.json"],
      metadata: {
        mapper_type: adapters.buildClaimGraph.kind,
        mapper_reason: runConfig.mappers.claim_decomposer.reason,
        claim_count: claimsArtifact.claims.length,
        edge_count: claimsArtifact.edges.length
      }
    });
    await validateOrThrow(validator, schemaIds.claims, claimsArtifact);
    await writeJson(artifactPath(runDir, "claims.json"), claimsArtifact);

    const evidenceArtifact = await runStage(
      context,
      adapters.gatherEvidence,
      ["claims.json", "source_inventory.json", "source_chunks.json"],
      ["evidence.json"],
      { claims: claimsArtifact, sourceInventory, sourceChunks },
      stageContext
    );
    const mapperSelection = runConfig.mappers.evidence_mapper;
    const mapperReason = mapperSelection.type === "llm" && !llm
        ? "LLM client unavailable; used deterministic fallback."
        : mapperSelection.type === "llm" && sourceInventory.sources.length === 0
          ? "LLM evidence mapper requires source inventory; used placeholder evidence."
          : mapperSelection.reason;
    await trace(runDir, {
      stage: "gather_evidence",
      event_type: "info",
      message: "Selected evidence mapper",
      input_artifacts: ["claims.json", "source_inventory.json", "source_chunks.json"],
      output_artifacts: ["evidence.json"],
      metadata: {
        mapper_type: adapters.gatherEvidence.kind,
        mapper_reason: mapperReason,
        source_count: sourceInventory.sources.length,
        chunk_count: sourceChunks.chunks.length,
        evidence_count: evidenceArtifact.evidence.length
      }
    });
    await validateOrThrow(validator, schemaIds.evidence, evidenceArtifact);
    await writeJson(artifactPath(runDir, "evidence.json"), evidenceArtifact);

    const contradictions = await runStage(context, adapters.verifyClaims, ["claims.json", "evidence.json"], ["contradictions.json"], {
      claims: claimsArtifact,
      evidence: evidenceArtifact
    }, stageContext);
    await validateOrThrow(validator, schemaIds.contradictions, contradictions);
    await writeJson(artifactPath(runDir, "contradictions.json"), contradictions);

    const redTeam = await runStage(context, adapters.redTeam, ["question_spec.json", "claims.json", "evidence.json", "contradictions.json"], ["red_team.md"], {
      claims: claimsArtifact,
      evidence: evidenceArtifact,
      contradictions
    }, stageContext);
    await writeText(artifactPath(runDir, "red_team.md"), redTeam);

    const uncertainty = await runStage(context, adapters.modelUncertainty, ["claims.json", "evidence.json", "contradictions.json", "red_team.md"], ["uncertainty.json"], {
      claims: claimsArtifact,
      evidence: evidenceArtifact,
      contradictions,
      redTeam
    }, stageContext);
    await validateOrThrow(validator, schemaIds.uncertainty, uncertainty);
    await writeJson(artifactPath(runDir, "uncertainty.json"), uncertainty);

    const decisionMemo = await runStage(context, adapters.writeDecisionMemo, ["question_spec.json", "claims.json", "evidence.json", "contradictions.json", "red_team.md", "uncertainty.json"], ["decision_memo.md"], {
      claims: claimsArtifact,
      evidence: evidenceArtifact,
      contradictions,
      redTeam,
      uncertainty
    }, stageContext);
    await writeText(artifactPath(runDir, "decision_memo.md"), decisionMemo);

    const evalReport = await runStage(context, adapters.evaluate, ["run_config.json", "question_spec.json", "source_inventory.json", "source_chunks.json", "claims.json", "evidence.json", "contradictions.json", "red_team.md", "uncertainty.json", "decision_memo.md"], ["eval_report.json"], undefined, stageContext);
    await validateOrThrow(validator, schemaIds.evalReport, evalReport);
    await writeJson(artifactPath(runDir, "eval_report.json"), evalReport);

    await updateLatestSymlink(runsDir, runId);
    return { runId, runDir };
  } catch (error) {
    await trace(runDir, {
      stage: "run",
      event_type: "error",
      message: error instanceof Error ? error.message : String(error),
      input_artifacts: [],
      output_artifacts: [],
      metadata: { runId }
    });
    throw error;
  }
}

export async function rerunEvaluation(projectRoot: string, runDir: string): Promise<void> {
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const report = await evaluateRun(projectRoot, absoluteRunDir);
  await validateOrThrow(validator, schemaIds.evalReport, report);
  await writeJson(path.join(absoluteRunDir, "eval_report.json"), report);
}

export async function replayRun(projectRoot: string, runDir: string): Promise<RunResult> {
  const inputPath = path.join(path.resolve(projectRoot, runDir), "input.yaml");
  return runHarness(projectRoot, inputPath);
}

async function runStage<Input, Output>(
  context: RunContext,
  adapter: StageAdapter<Input, Output>,
  inputArtifacts: string[],
  outputArtifacts: string[],
  input: Input,
  stageContext: StageAdapterContext
): Promise<Output> {
  await trace(context.runDir, {
    stage: adapter.stage,
    event_type: "start",
    message: `Starting ${adapter.stage}`,
    input_artifacts: inputArtifacts,
    output_artifacts: outputArtifacts,
    metadata: stageModuleMetadata(adapter, { runId: context.runId })
  });

  const result = await runStageModule(adapter, () => adapter.run(input, stageContext));

  await trace(context.runDir, {
    stage: adapter.stage,
    event_type: "complete",
    message: `Completed ${adapter.stage}`,
    input_artifacts: inputArtifacts,
    output_artifacts: outputArtifacts,
    metadata: stageModuleMetadata(adapter, {
      runId: context.runId,
      attempts: result.attempts,
      duration_ms: result.duration_ms
    })
  });

  return result.value;
}

async function validateOrThrow(validator: ArtifactValidator, schemaId: string, artifact: unknown): Promise<void> {
  const result = await validator.validate(schemaId, artifact);
  if (!result.valid) {
    throw new Error(`Artifact failed schema validation for ${schemaId}: ${result.errors.join("; ")}`);
  }
}

async function createRunId(runsDir: string, slug: string): Promise<string> {
  await mkdir(runsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  let runId = `${stamp}-${slug}`;
  let attempt = 1;

  while (true) {
    try {
      await mkdir(path.join(runsDir, runId));
      return runId;
    } catch {
      attempt += 1;
      runId = `${stamp}-${slug}-${attempt}`;
    }
  }
}
