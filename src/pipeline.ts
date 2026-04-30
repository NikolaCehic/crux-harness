import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  buildClaims,
  buildContradictions,
  buildDecisionMemo,
  buildEvidence,
  buildQuestionSpec,
  buildRedTeam,
  buildUncertainty
} from "./artifacts.js";
import { evaluateRun } from "./evaluator.js";
import { artifactPath, copyIntoRun, ensureDir, updateLatestSymlink, writeJson, writeText } from "./fs.js";
import { loadInput, slugFromInput } from "./input.js";
import { trace } from "./trace.js";
import type { RunContext } from "./types.js";
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

    await runStage(context, "build_claim_graph", ["question_spec.json"], ["claims.json"], async () => {
      const artifact = buildClaims();
      await validateOrThrow(validator, schemaIds.claims, artifact);
      await writeJson(artifactPath(runDir, "claims.json"), artifact);
    });

    await runStage(context, "gather_evidence", ["claims.json"], ["evidence.json"], async () => {
      const artifact = buildEvidence();
      await validateOrThrow(validator, schemaIds.evidence, artifact);
      await writeJson(artifactPath(runDir, "evidence.json"), artifact);
    });

    await runStage(context, "verify_claims", ["claims.json", "evidence.json"], ["contradictions.json"], async () => {
      const artifact = buildContradictions();
      await validateOrThrow(validator, schemaIds.contradictions, artifact);
      await writeJson(artifactPath(runDir, "contradictions.json"), artifact);
    });

    await runStage(context, "red_team", ["question_spec.json", "claims.json", "evidence.json", "contradictions.json"], ["red_team.md"], async () => {
      await writeText(artifactPath(runDir, "red_team.md"), buildRedTeam());
    });

    await runStage(context, "model_uncertainty", ["claims.json", "evidence.json", "contradictions.json", "red_team.md"], ["uncertainty.json"], async () => {
      const artifact = buildUncertainty();
      await validateOrThrow(validator, schemaIds.uncertainty, artifact);
      await writeJson(artifactPath(runDir, "uncertainty.json"), artifact);
    });

    await runStage(context, "write_decision_memo", ["question_spec.json", "claims.json", "evidence.json", "contradictions.json", "red_team.md", "uncertainty.json"], ["decision_memo.md"], async () => {
      await writeText(artifactPath(runDir, "decision_memo.md"), buildDecisionMemo(input));
    });

    await runStage(context, "evaluate", ["question_spec.json", "claims.json", "evidence.json", "contradictions.json", "red_team.md", "uncertainty.json", "decision_memo.md"], ["eval_report.json"], async () => {
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
      await rm(path.join(runsDir, runId), { recursive: true, force: true });
      return runId;
    } catch {
      attempt += 1;
      runId = `${stamp}-${slug}-${attempt}`;
    }
  }
}
