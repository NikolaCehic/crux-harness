import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClaimsArtifact, EvidenceArtifact, ReviewAction, ReviewArtifact, RunConfig } from "./types.js";
import { trace } from "./trace.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

export type ClaimReviewInput = {
  claimId: string;
  status: "approved" | "rejected";
  reviewer: string;
  rationale: string;
};

export type EvidenceAnnotationInput = {
  evidenceId: string;
  reviewer: string;
  note: string;
};

export async function initReview(projectRoot: string, runDir: string): Promise<ReviewArtifact> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const existing = await readReviewIfExists(absoluteRunDir);
  if (existing) {
    return existing;
  }

  const runConfig = await readJson<RunConfig>(absoluteRunDir, "run_config.json");
  const now = new Date().toISOString();
  const review: ReviewArtifact = {
    schema_version: "crux.review.v1",
    run_id: runConfig.run_id,
    created_at: now,
    updated_at: now,
    actions: [],
    summary: {
      approved_claims: [],
      rejected_claims: [],
      evidence_annotations: [],
      stage_rerun_requests: []
    }
  };

  await writeReview(projectRoot, absoluteRunDir, review);
  return review;
}

export async function addClaimReview(projectRoot: string, runDir: string, input: ClaimReviewInput): Promise<ReviewAction> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const claims = await readJson<ClaimsArtifact>(absoluteRunDir, "claims.json");
  if (!claims.claims.some((claim) => claim.id === input.claimId)) {
    throw new Error(`Unknown claim ID: ${input.claimId}`);
  }

  const review = await initReview(projectRoot, absoluteRunDir);
  const action = buildAction(review, {
    reviewer: input.reviewer,
    action_type: input.status === "approved" ? "approve_claim" : "reject_claim",
    target: { type: "claim", id: input.claimId },
    rationale: input.rationale,
    metadata: { status: input.status }
  });
  await appendAction(projectRoot, absoluteRunDir, review, action, `claim ${input.claimId} ${input.status}`);
  return action;
}

export async function addEvidenceAnnotation(projectRoot: string, runDir: string, input: EvidenceAnnotationInput): Promise<ReviewAction> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const evidence = await readJson<EvidenceArtifact>(absoluteRunDir, "evidence.json");
  if (!evidence.evidence.some((item) => item.id === input.evidenceId)) {
    throw new Error(`Unknown evidence ID: ${input.evidenceId}`);
  }

  const review = await initReview(projectRoot, absoluteRunDir);
  const action = buildAction(review, {
    reviewer: input.reviewer,
    action_type: "annotate_evidence",
    target: { type: "evidence", id: input.evidenceId },
    rationale: input.note,
    metadata: { note: input.note }
  });
  await appendAction(projectRoot, absoluteRunDir, review, action, `evidence ${input.evidenceId} annotated`);
  return action;
}

export async function exportReviewedMemo(projectRoot: string, runDir: string, outPath?: string): Promise<string> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const review = await initReview(projectRoot, absoluteRunDir);
  const memo = await readFile(path.join(absoluteRunDir, "decision_memo.md"), "utf8");
  const target = resolveReviewOutput(projectRoot, absoluteRunDir, outPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, renderReviewedMemo(review, memo), "utf8");
  return path.relative(projectRoot, target);
}

function buildAction(
  review: ReviewArtifact,
  input: Omit<ReviewAction, "id" | "created_at">
): ReviewAction {
  return {
    id: `R${review.actions.length + 1}`,
    created_at: new Date().toISOString(),
    ...input
  };
}

async function appendAction(
  projectRoot: string,
  runDir: string,
  review: ReviewArtifact,
  action: ReviewAction,
  message: string
): Promise<void> {
  const nextReview: ReviewArtifact = {
    ...review,
    updated_at: action.created_at,
    actions: [...review.actions, action]
  };
  nextReview.summary = summarizeActions(nextReview.actions);

  await writeReview(projectRoot, runDir, nextReview);
  await trace(runDir, {
    stage: "human_review",
    event_type: "info",
    message,
    input_artifacts: ["review.json"],
    output_artifacts: ["review.json"],
    metadata: {
      action_id: action.id,
      action_type: action.action_type,
      reviewer: action.reviewer,
      target: action.target
    }
  });
}

function summarizeActions(actions: ReviewAction[]): ReviewArtifact["summary"] {
  const claimStatuses = new Map<string, "approved" | "rejected">();
  const evidenceNoteCounts = new Map<string, number>();
  const stageRerunRequests = new Set<string>();

  for (const action of actions) {
    if (action.action_type === "approve_claim") {
      claimStatuses.set(action.target.id, "approved");
    } else if (action.action_type === "reject_claim") {
      claimStatuses.set(action.target.id, "rejected");
    } else if (action.action_type === "annotate_evidence") {
      evidenceNoteCounts.set(action.target.id, (evidenceNoteCounts.get(action.target.id) ?? 0) + 1);
    } else if (action.action_type === "request_stage_rerun") {
      stageRerunRequests.add(action.target.id);
    }
  }

  return {
    approved_claims: [...claimStatuses.entries()]
      .filter(([, status]) => status === "approved")
      .map(([claimId]) => claimId),
    rejected_claims: [...claimStatuses.entries()]
      .filter(([, status]) => status === "rejected")
      .map(([claimId]) => claimId),
    evidence_annotations: [...evidenceNoteCounts.entries()].map(([evidenceId, noteCount]) => ({
      evidence_id: evidenceId,
      note_count: noteCount
    })),
    stage_rerun_requests: [...stageRerunRequests]
  };
}

function renderReviewedMemo(review: ReviewArtifact, memo: string): string {
  const evidenceNotes = review.actions.filter((action) => action.action_type === "annotate_evidence");

  return `# Reviewed Crux Memo

Run ID: ${review.run_id}
Review updated: ${review.updated_at}

## Human Review Summary

Approved claims: ${review.summary.approved_claims.join(", ") || "none"}
Rejected claims: ${review.summary.rejected_claims.join(", ") || "none"}
Stage rerun requests: ${review.summary.stage_rerun_requests.join(", ") || "none"}

## Evidence Annotations

${evidenceNotes.length > 0
  ? evidenceNotes.map((action) => `- ${action.target.id}: ${action.rationale}`).join("\n")
  : "- none"}

## Machine-generated memo follows

${memo}`;
}

async function writeReview(projectRoot: string, runDir: string, review: ReviewArtifact): Promise<void> {
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const result = await validator.validate(schemaIds.review, review);
  if (!result.valid) {
    throw new Error(`review.json failed schema validation: ${result.errors.join("; ")}`);
  }

  await writeFile(path.join(runDir, "review.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8");
}

async function readReviewIfExists(runDir: string): Promise<ReviewArtifact | undefined> {
  try {
    return JSON.parse(await readFile(path.join(runDir, "review.json"), "utf8")) as ReviewArtifact;
  } catch {
    return undefined;
  }
}

async function readJson<T>(runDir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
}

function resolveReviewOutput(projectRoot: string, runDir: string, outPath?: string): string {
  if (!outPath) {
    return path.join(runDir, "reviewed_memo.md");
  }
  if (path.isAbsolute(outPath)) {
    return outPath;
  }
  if (path.dirname(outPath) === ".") {
    return path.join(runDir, outPath);
  }
  return path.resolve(projectRoot, outPath);
}
