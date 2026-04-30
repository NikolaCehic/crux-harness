import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  buildClaims,
  buildContradictions,
  buildDecisionMemo,
  buildEvidence,
  buildPlaceholderEvidence,
  buildQuestionSpec,
  buildRedTeam,
  buildUncertainty
} from "./artifacts.js";
import { mapEvidenceWithLlm, selectEvidenceMapper } from "./evidence-mapper.js";
import { evaluateRun } from "./evaluator.js";
import { artifactPath, copyIntoRun, ensureDir, updateLatestSymlink, writeJson, writeText } from "./fs.js";
import { loadInput, slugFromInput } from "./input.js";
import { createConfiguredLlmClient } from "./llm.js";
import { buildSourceChunks, buildSourceInventory } from "./sources.js";
import { trace } from "./trace.js";
import type { RunContext, SourceChunksArtifact, SourceInventory } from "./types.js";
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
  await copyIntoRun(absoluteInputPath, runDir);
  await writeText(path.join(runDir, "trace.jsonl"), "");

  const context: RunContext = {
    projectRoot,
    runDir,
    runId,
    inputPath: absoluteInputPath,
    input
  };

  try {
    await runStage(context, "normalize_question", ["input.yaml"], ["question_spec.json"], async () => {
      const artifact = buildQuestionSpec(input);
      await validateOrThrow(validator, schemaIds.questionSpec, artifact);
      await writeJson(artifactPath(runDir, "question_spec.json"), artifact);
    });

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
    await runStage(context, "ingest_sources", ["input.yaml"], ["source_inventory.json", "source_chunks.json"], async () => {
      sourceInventory = await buildSourceInventory(projectRoot, input);
      sourceChunks = await buildSourceChunks(projectRoot, sourceInventory);
      await validateOrThrow(validator, schemaIds.sourceInventory, sourceInventory);
      await validateOrThrow(validator, schemaIds.sourceChunks, sourceChunks);
      await writeJson(artifactPath(runDir, "source_inventory.json"), sourceInventory);
      await writeJson(artifactPath(runDir, "source_chunks.json"), sourceChunks);
    });

    await runStage(context, "build_claim_graph", ["question_spec.json", "source_inventory.json", "source_chunks.json"], ["claims.json"], async () => {
      const artifact = buildClaims(input);
      await validateOrThrow(validator, schemaIds.claims, artifact);
      await writeJson(artifactPath(runDir, "claims.json"), artifact);
    });

    await runStage(context, "gather_evidence", ["claims.json", "source_inventory.json", "source_chunks.json"], ["evidence.json"], async () => {
      const claims = buildClaims(input);
      const mapperSelection = selectEvidenceMapper({ env: process.env });
      const llm = createConfiguredLlmClient();
      const useLlmEvidenceMapper = mapperSelection.type === "llm" && llm && sourceInventory.sources.length > 0;
      const mapperReason = mapperSelection.type === "llm" && !llm
        ? "LLM client unavailable; used deterministic fallback."
        : mapperSelection.type === "llm" && sourceInventory.sources.length === 0
          ? "LLM evidence mapper requires source inventory; used placeholder evidence."
          : mapperSelection.reason;
      const artifact = useLlmEvidenceMapper
        ? await mapEvidenceWithLlm({
            input,
            claims,
            sourceInventory,
            sourceChunks,
            llm,
            projectRoot
          })
        : sourceInventory.sources.length > 0
          ? buildEvidence(input, sourceInventory, sourceChunks)
          : buildPlaceholderEvidence(input);

      await trace(runDir, {
        stage: "gather_evidence",
        event_type: "info",
        message: "Selected evidence mapper",
        input_artifacts: ["claims.json", "source_inventory.json", "source_chunks.json"],
        output_artifacts: ["evidence.json"],
        metadata: {
          mapper_type: useLlmEvidenceMapper ? "llm" : "deterministic",
          mapper_reason: mapperReason,
          source_count: sourceInventory.sources.length,
          chunk_count: sourceChunks.chunks.length,
          evidence_count: artifact.evidence.length
        }
      });
      await validateOrThrow(validator, schemaIds.evidence, artifact);
      await writeJson(artifactPath(runDir, "evidence.json"), artifact);
    });

    await runStage(context, "verify_claims", ["claims.json", "evidence.json"], ["contradictions.json"], async () => {
      const artifact = buildContradictions(input);
      await validateOrThrow(validator, schemaIds.contradictions, artifact);
      await writeJson(artifactPath(runDir, "contradictions.json"), artifact);
    });

    await runStage(context, "red_team", ["question_spec.json", "claims.json", "evidence.json", "contradictions.json"], ["red_team.md"], async () => {
      await writeText(artifactPath(runDir, "red_team.md"), buildRedTeam(input));
    });

    await runStage(context, "model_uncertainty", ["claims.json", "evidence.json", "contradictions.json", "red_team.md"], ["uncertainty.json"], async () => {
      const artifact = buildUncertainty(input);
      await validateOrThrow(validator, schemaIds.uncertainty, artifact);
      await writeJson(artifactPath(runDir, "uncertainty.json"), artifact);
    });

    await runStage(context, "write_decision_memo", ["question_spec.json", "claims.json", "evidence.json", "contradictions.json", "red_team.md", "uncertainty.json"], ["decision_memo.md"], async () => {
      await writeText(artifactPath(runDir, "decision_memo.md"), buildDecisionMemo(input));
    });

    await runStage(context, "evaluate", ["question_spec.json", "source_inventory.json", "source_chunks.json", "claims.json", "evidence.json", "contradictions.json", "red_team.md", "uncertainty.json", "decision_memo.md"], ["eval_report.json"], async () => {
      const artifact = await evaluateRun(projectRoot, runDir);
      await validateOrThrow(validator, schemaIds.evalReport, artifact);
      await writeJson(artifactPath(runDir, "eval_report.json"), artifact);
    });

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

async function runStage(
  context: RunContext,
  stage: string,
  inputArtifacts: string[],
  outputArtifacts: string[],
  work: () => Promise<void>
): Promise<void> {
  await trace(context.runDir, {
    stage,
    event_type: "start",
    message: `Starting ${stage}`,
    input_artifacts: inputArtifacts,
    output_artifacts: outputArtifacts,
    metadata: { runId: context.runId }
  });

  await work();

  await trace(context.runDir, {
    stage,
    event_type: "complete",
    message: `Completed ${stage}`,
    input_artifacts: inputArtifacts,
    output_artifacts: outputArtifacts,
    metadata: { runId: context.runId }
  });
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
