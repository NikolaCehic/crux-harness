import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ClaimsArtifact,
  ContradictionsArtifact,
  EvalReport,
  EvidenceArtifact,
  QuestionSpec,
  RunConfig,
  SourceChunksArtifact,
  SourceInventory,
  TraceEvent,
  UncertaintyArtifact
} from "./types.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

export type IntegrityReport = {
  valid: boolean;
  failures: string[];
};

const requiredFiles = [
  "input.yaml",
  "run_config.json",
  "question_spec.json",
  "source_inventory.json",
  "source_chunks.json",
  "claims.json",
  "evidence.json",
  "contradictions.json",
  "red_team.md",
  "uncertainty.json",
  "decision_memo.md",
  "eval_report.json",
  "trace.jsonl"
] as const;

const expectedStages = [
  "normalize_question",
  "ingest_sources",
  "build_claim_graph",
  "gather_evidence",
  "verify_claims",
  "red_team",
  "model_uncertainty",
  "write_decision_memo",
  "evaluate"
] as const;

export async function validateRunIntegrity(projectRoot: string, runDir: string): Promise<IntegrityReport> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const failures: string[] = [];

  for (const file of requiredFiles) {
    if (!existsSync(path.join(absoluteRunDir, file))) {
      failures.push(`Missing required artifact: ${file}`);
    }
  }

  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const runConfig = await readJson<RunConfig>(absoluteRunDir, "run_config.json", failures);
  const questionSpec = await readJson<QuestionSpec>(absoluteRunDir, "question_spec.json", failures);
  const sourceInventory = await readJson<SourceInventory>(absoluteRunDir, "source_inventory.json", failures);
  const sourceChunks = await readJson<SourceChunksArtifact>(absoluteRunDir, "source_chunks.json", failures);
  const claims = await readJson<ClaimsArtifact>(absoluteRunDir, "claims.json", failures);
  const evidence = await readJson<EvidenceArtifact>(absoluteRunDir, "evidence.json", failures);
  const contradictions = await readJson<ContradictionsArtifact>(absoluteRunDir, "contradictions.json", failures);
  const uncertainty = await readJson<UncertaintyArtifact>(absoluteRunDir, "uncertainty.json", failures);
  const evalReport = await readJson<EvalReport>(absoluteRunDir, "eval_report.json", failures);
  const redTeam = await readText(absoluteRunDir, "red_team.md", failures);
  const decisionMemo = await readText(absoluteRunDir, "decision_memo.md", failures);
  const traceLines = await readTrace(absoluteRunDir, failures);

  await validateSchema(validator, schemaIds.runConfig, "run_config.json", runConfig, failures);
  await validateSchema(validator, schemaIds.questionSpec, "question_spec.json", questionSpec, failures);
  await validateSchema(validator, schemaIds.sourceInventory, "source_inventory.json", sourceInventory, failures);
  await validateSchema(validator, schemaIds.sourceChunks, "source_chunks.json", sourceChunks, failures);
  await validateSchema(validator, schemaIds.claims, "claims.json", claims, failures);
  await validateSchema(validator, schemaIds.evidence, "evidence.json", evidence, failures);
  await validateSchema(validator, schemaIds.contradictions, "contradictions.json", contradictions, failures);
  await validateSchema(validator, schemaIds.uncertainty, "uncertainty.json", uncertainty, failures);
  await validateSchema(validator, schemaIds.evalReport, "eval_report.json", evalReport, failures);

  if (claims && evidence && contradictions) {
    validateClaimEvidenceGraph(claims, evidence, contradictions, failures);
  }

  if (sourceInventory && sourceChunks && evidence) {
    validateSourceProvenance(projectRoot, sourceInventory, sourceChunks, evidence, failures);
  }

  if (uncertainty) {
    validateUncertainty(uncertainty, failures);
  }

  validateMarkdownSections("red_team.md", redTeam, [
    "## Opposing Thesis",
    "## Strongest Counterarguments",
    "## Failure Modes",
    "## Missing Evidence",
    "## Recommendation Impact"
  ], failures);

  validateMarkdownSections("decision_memo.md", decisionMemo, [
    "## Recommendation",
    "## Executive Summary",
    "## Core Reasoning",
    "## Key Claims",
    "## Evidence Quality",
    "## Red-Team Findings",
    "## Uncertainty",
    "## What Would Change This Decision",
    "## Next Tests"
  ], failures);

  validateTrace(traceLines, failures);

  if (evalReport) {
    if (evalReport.scores.schema_validity !== 1) {
      failures.push("eval_report.json schema_validity score must be 1.");
    }
    if (evalReport.failed_checks.length > 0) {
      failures.push(`eval_report.json has failed checks: ${evalReport.failed_checks.join("; ")}`);
    }
  }

  if (questionSpec && decisionMemo && !decisionMemo.toLowerCase().includes(questionSpec.time_horizon.toLowerCase())) {
    failures.push("decision_memo.md should mention the normalized time horizon.");
  }

  return { valid: failures.length === 0, failures };
}

function validateSourceProvenance(
  projectRoot: string,
  sourceInventory: SourceInventory,
  sourceChunks: SourceChunksArtifact,
  evidenceArtifact: EvidenceArtifact,
  failures: string[]
): void {
  const sourceIds = new Set(sourceInventory.sources.map((source) => source.id));
  const chunksById = new Map(sourceChunks.chunks.map((chunk) => [chunk.id, chunk]));

  for (const source of sourceInventory.sources) {
    if (!existsSync(path.resolve(projectRoot, source.path))) {
      failures.push(`source_inventory.json references missing source file: ${source.path}`);
    }
  }

  for (const item of evidenceArtifact.evidence) {
    for (const sourceId of item.source_ids ?? []) {
      assertKnown(sourceId, sourceIds, `Evidence ${item.id} references unknown source ${sourceId}.`, failures);
    }
    for (const chunkId of item.chunk_ids ?? []) {
      const chunk = chunksById.get(chunkId);
      if (!chunk) {
        failures.push(`Evidence ${item.id} references unknown source chunk ${chunkId}.`);
      } else if ((item.source_ids ?? []).length > 0 && !(item.source_ids ?? []).includes(chunk.source_id)) {
        failures.push(`Evidence ${item.id} chunk ${chunkId} does not belong to cited sources ${item.source_ids?.join(", ")}.`);
      }
    }
  }

  if (sourceInventory.sources.length === 0) {
    return;
  }

  for (const item of evidenceArtifact.evidence) {
    if (item.limitations.toLowerCase().includes("placeholder")) {
      failures.push(`Evidence ${item.id} uses placeholder limitations in source-grounded mode.`);
    }

    if (item.source_type !== "calculation" && (item.source_ids ?? []).length === 0) {
      failures.push(`Evidence ${item.id} is source-backed mode evidence but has no source_ids.`);
    }

    if (item.source_type !== "calculation" && (item.chunk_ids ?? []).length === 0) {
      failures.push(`Evidence ${item.id} is source-backed mode evidence but has no chunk_ids.`);
    }

    if (item.source_type !== "calculation" && !item.excerpt) {
      failures.push(`Evidence ${item.id} is source-backed mode evidence but has no excerpt.`);
    }

    if (item.excerpt && (item.chunk_ids ?? []).length > 0) {
      const matchingChunk = (item.chunk_ids ?? [])
        .map((chunkId) => chunksById.get(chunkId))
        .filter((chunk): chunk is NonNullable<typeof chunk> => Boolean(chunk))
        .some((chunk) => includesExcerpt(chunk.text, item.excerpt ?? ""));

      if (!matchingChunk) {
        failures.push(`Evidence ${item.id} excerpt is not present in its cited source chunks.`);
      }
    }
  }
}

function includesExcerpt(chunkText: string, excerpt: string): boolean {
  return normalizeForExcerpt(chunkText).includes(normalizeForExcerpt(excerpt));
}

function normalizeForExcerpt(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

async function validateSchema(
  validator: ArtifactValidator,
  schemaId: string,
  file: string,
  value: unknown,
  failures: string[]
): Promise<void> {
  if (value === undefined) {
    return;
  }

  const result = await validator.validate(schemaId, value);
  if (!result.valid) {
    failures.push(`${file} failed schema validation: ${result.errors.join("; ")}`);
  }
}

function validateClaimEvidenceGraph(
  claimsArtifact: ClaimsArtifact,
  evidenceArtifact: EvidenceArtifact,
  contradictionsArtifact: ContradictionsArtifact,
  failures: string[]
): void {
  const claimIds = new Set(claimsArtifact.claims.map((claim) => claim.id));
  const evidenceIds = new Set(evidenceArtifact.evidence.map((item) => item.id));
  const dependencyMap = new Map(claimsArtifact.claims.map((claim) => [claim.id, claim.depends_on]));

  if (claimIds.size !== claimsArtifact.claims.length) {
    failures.push("claims.json contains duplicate claim IDs.");
  }

  if (evidenceIds.size !== evidenceArtifact.evidence.length) {
    failures.push("evidence.json contains duplicate evidence IDs.");
  }

  for (const rootId of claimsArtifact.root_claim_ids) {
    assertKnown(rootId, claimIds, `Unknown root_claim_id: ${rootId}`, failures);
  }

  for (const claim of claimsArtifact.claims) {
    if (claim.depends_on.includes(claim.id)) {
      failures.push(`Claim ${claim.id} depends on itself.`);
    }
    for (const dependency of claim.depends_on) {
      assertKnown(dependency, claimIds, `Claim ${claim.id} depends on unknown claim ${dependency}.`, failures);
    }
    for (const evidenceId of [...claim.evidence_ids, ...claim.counterevidence_ids]) {
      assertKnown(evidenceId, evidenceIds, `Claim ${claim.id} references unknown evidence ${evidenceId}.`, failures);
    }
  }

  validateDependencyCycles(claimIds, dependencyMap, failures);

  for (const edge of claimsArtifact.edges) {
    assertKnown(edge.from, claimIds, `Edge references unknown from claim ${edge.from}.`, failures);
    assertKnown(edge.to, claimIds, `Edge references unknown to claim ${edge.to}.`, failures);
  }

  for (const item of evidenceArtifact.evidence) {
    for (const claimId of [...item.supports_claim_ids, ...item.challenges_claim_ids]) {
      assertKnown(claimId, claimIds, `Evidence ${item.id} references unknown claim ${claimId}.`, failures);
    }
  }

  for (const contradiction of contradictionsArtifact.contradictions) {
    for (const claimId of contradiction.claim_ids) {
      assertKnown(claimId, claimIds, `Contradiction ${contradiction.id} references unknown claim ${claimId}.`, failures);
    }
  }

  for (const claimId of contradictionsArtifact.unsupported_critical_claims) {
    assertKnown(claimId, claimIds, `Unsupported critical claim references unknown claim ${claimId}.`, failures);
  }
}

function validateDependencyCycles(claimIds: Set<string>, dependencyMap: Map<string, string[]>, failures: string[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const cycles = new Set<string>();

  const visit = (claimId: string, trail: string[]): void => {
    if (visiting.has(claimId)) {
      const cycle = [...trail, claimId].join(" -> ");
      cycles.add(cycle);
      return;
    }
    if (visited.has(claimId)) {
      return;
    }

    visiting.add(claimId);
    for (const dependency of dependencyMap.get(claimId) ?? []) {
      if (claimIds.has(dependency)) {
        visit(dependency, [...trail, claimId]);
      }
    }
    visiting.delete(claimId);
    visited.add(claimId);
  };

  for (const claimId of claimIds) {
    visit(claimId, []);
  }

  for (const cycle of cycles) {
    failures.push(`Claim graph contains dependency cycle: ${cycle}.`);
  }
}

function validateUncertainty(uncertainty: UncertaintyArtifact, failures: string[]): void {
  if (uncertainty.key_uncertainties.length < 3) {
    failures.push("uncertainty.json should contain at least 3 key uncertainties.");
  }
  if (uncertainty.what_would_change_my_mind.length === 0) {
    failures.push("uncertainty.json must include what_would_change_my_mind entries.");
  }
  if (uncertainty.recommended_tests.length === 0) {
    failures.push("uncertainty.json must include recommended_tests entries.");
  }
}

function validateMarkdownSections(file: string, markdown: string | undefined, sections: string[], failures: string[]): void {
  if (!markdown) {
    return;
  }

  for (const section of sections) {
    if (!markdown.includes(section)) {
      failures.push(`${file} missing section: ${section}`);
    }
  }
}

function validateTrace(traceLines: TraceEvent[], failures: string[]): void {
  if (traceLines.length === 0) {
    failures.push("trace.jsonl is empty.");
    return;
  }

  for (const stage of expectedStages) {
    const hasStart = traceLines.some((event) => event.stage === stage && event.event_type === "start");
    const hasComplete = traceLines.some((event) => event.stage === stage && event.event_type === "complete");
    if (!hasStart) {
      failures.push(`trace.jsonl missing start event for ${stage}.`);
    }
    if (!hasComplete) {
      failures.push(`trace.jsonl missing complete event for ${stage}.`);
    }
  }
}

async function readJson<T>(runDir: string, file: string, failures: string[]): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
  } catch (error) {
    failures.push(`Could not read valid ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function readText(runDir: string, file: string, failures: string[]): Promise<string | undefined> {
  try {
    return readFile(path.join(runDir, file), "utf8");
  } catch (error) {
    failures.push(`Could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function readTrace(runDir: string, failures: string[]): Promise<TraceEvent[]> {
  try {
    const raw = await readFile(path.join(runDir, "trace.jsonl"), "utf8");
    return raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as TraceEvent);
  } catch (error) {
    failures.push(`Could not read valid trace.jsonl: ${error instanceof Error ? error.message : String(error)}`);
    return [];
  }
}

function assertKnown(id: string, knownIds: Set<string>, message: string, failures: string[]): void {
  if (!knownIds.has(id)) {
    failures.push(message);
  }
}
