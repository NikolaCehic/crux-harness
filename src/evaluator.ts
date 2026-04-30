import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ClaimsArtifact,
  ContradictionsArtifact,
  EvalReport,
  EvidenceArtifact,
  QuestionSpec,
  SourceChunksArtifact,
  SourceInventory,
  UncertaintyArtifact
} from "./types.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

type LoadedRun = {
  questionSpec?: QuestionSpec;
  sourceInventory?: SourceInventory;
  sourceChunks?: SourceChunksArtifact;
  claims?: ClaimsArtifact;
  evidence?: EvidenceArtifact;
  contradictions?: ContradictionsArtifact;
  uncertainty?: UncertaintyArtifact;
  redTeam?: string;
  decisionMemo?: string;
  failedChecks: string[];
};

export async function evaluateRun(projectRoot: string, runDir: string): Promise<EvalReport> {
  const validator = new ArtifactValidator(path.join(projectRoot, "schemas"));
  const loaded = await loadRun(runDir);
  const validationFailures = await validateLoadedRun(validator, loaded);
  const failedChecks = [...loaded.failedChecks, ...validationFailures];

  const scores = {
    schema_validity: validationFailures.length === 0 && loaded.failedChecks.length === 0 ? 1 : 0,
    claim_coverage: scoreClaimCoverage(loaded.claims),
    evidence_traceability: scoreEvidenceTraceability(loaded.claims),
    source_quality: scoreSourceQuality(loaded.evidence),
    contradiction_handling: scoreContradictions(loaded.contradictions),
    red_team_strength: scoreMarkdownSections(loaded.redTeam, [
      "## Opposing Thesis",
      "## Strongest Counterarguments",
      "## Failure Modes",
      "## Missing Evidence",
      "## Recommendation Impact"
    ]),
    uncertainty_quality: scoreUncertainty(loaded.uncertainty),
    decision_usefulness: scoreMarkdownSections(loaded.decisionMemo, [
      "## Recommendation",
      "## Executive Summary",
      "## Core Reasoning",
      "## Key Claims",
      "## Evidence Quality",
      "## Red-Team Findings",
      "## Uncertainty",
      "## What Would Change This Decision",
      "## Next Tests"
    ])
  };

  const findings = buildFindings(loaded, failedChecks);
  const improvement_recommendations = buildRecommendations(loaded, failedChecks);

  return {
    scores,
    findings,
    failed_checks: failedChecks,
    improvement_recommendations
  };
}

async function loadRun(runDir: string): Promise<LoadedRun> {
  const failedChecks: string[] = [];

  const [questionSpec, sourceInventory, sourceChunks, claims, evidence, contradictions, uncertainty, redTeam, decisionMemo] = await Promise.all([
    readJson<QuestionSpec>(runDir, "question_spec.json", failedChecks),
    readJson<SourceInventory>(runDir, "source_inventory.json", failedChecks),
    readJson<SourceChunksArtifact>(runDir, "source_chunks.json", failedChecks),
    readJson<ClaimsArtifact>(runDir, "claims.json", failedChecks),
    readJson<EvidenceArtifact>(runDir, "evidence.json", failedChecks),
    readJson<ContradictionsArtifact>(runDir, "contradictions.json", failedChecks),
    readJson<UncertaintyArtifact>(runDir, "uncertainty.json", failedChecks),
    readText(runDir, "red_team.md", failedChecks),
    readText(runDir, "decision_memo.md", failedChecks)
  ]);

  return { questionSpec, sourceInventory, sourceChunks, claims, evidence, contradictions, uncertainty, redTeam, decisionMemo, failedChecks };
}

async function readJson<T>(runDir: string, file: string, failedChecks: string[]): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
  } catch (error) {
    failedChecks.push(`Could not read valid ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function readText(runDir: string, file: string, failedChecks: string[]): Promise<string | undefined> {
  try {
    return readFile(path.join(runDir, file), "utf8");
  } catch (error) {
    failedChecks.push(`Could not read ${file}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

async function validateLoadedRun(validator: ArtifactValidator, loaded: LoadedRun): Promise<string[]> {
  const checks: Array<[string, string, unknown]> = [
    ["question_spec.json", schemaIds.questionSpec, loaded.questionSpec],
    ["source_inventory.json", schemaIds.sourceInventory, loaded.sourceInventory],
    ["source_chunks.json", schemaIds.sourceChunks, loaded.sourceChunks],
    ["claims.json", schemaIds.claims, loaded.claims],
    ["evidence.json", schemaIds.evidence, loaded.evidence],
    ["contradictions.json", schemaIds.contradictions, loaded.contradictions],
    ["uncertainty.json", schemaIds.uncertainty, loaded.uncertainty]
  ];

  const failures: string[] = [];
  for (const [file, schemaId, value] of checks) {
    if (value === undefined) {
      continue;
    }

    const result = await validator.validate(schemaId, value);
    if (!result.valid) {
      failures.push(`${file} failed schema validation: ${result.errors.join("; ")}`);
    }
  }

  return failures;
}

function scoreClaimCoverage(claims?: ClaimsArtifact): number {
  if (!claims) {
    return 0;
  }

  const countScore = Math.min(claims.claims.length / 12, 1);
  const rootScore = Math.min(claims.root_claim_ids.length / 3, 1);
  const edgeScore = Math.min(claims.edges.length / 12, 1);
  return round((countScore + rootScore + edgeScore) / 3);
}

function scoreEvidenceTraceability(claims?: ClaimsArtifact): number {
  if (!claims || claims.claims.length === 0) {
    return 0;
  }

  const traceable = claims.claims.filter((claim) => {
    return claim.evidence_ids.length > 0 || claim.counterevidence_ids.length > 0 || ["unsupported", "unknown"].includes(claim.status);
  }).length;

  return round(traceable / claims.claims.length);
}

function scoreSourceQuality(evidence?: EvidenceArtifact): number {
  if (!evidence || evidence.evidence.length === 0) {
    return 0;
  }

  const total = evidence.evidence.reduce((sum, item) => {
    return sum + (item.reliability * 0.45 + item.relevance * 0.4 + item.recency * 0.15);
  }, 0);

  return round(total / evidence.evidence.length);
}

function scoreContradictions(contradictions?: ContradictionsArtifact): number {
  if (!contradictions) {
    return 0;
  }

  const contradictionScore = Math.min(contradictions.contradictions.length / 3, 1);
  const unsupportedScore = contradictions.unsupported_critical_claims.length > 0 ? 1 : 0.5;
  const missingEvidenceScore = Math.min(contradictions.missing_evidence.length / 4, 1);
  return round((contradictionScore + unsupportedScore + missingEvidenceScore) / 3);
}

function scoreUncertainty(uncertainty?: UncertaintyArtifact): number {
  if (!uncertainty) {
    return 0;
  }

  const keyScore = Math.min(uncertainty.key_uncertainties.length / 5, 1);
  const sensitivityScore = Math.min(uncertainty.sensitivity.length / 2, 1);
  const changeScore = Math.min(uncertainty.what_would_change_my_mind.length / 5, 1);
  const testsScore = Math.min(uncertainty.recommended_tests.length / 5, 1);
  return round((keyScore + sensitivityScore + changeScore + testsScore) / 4);
}

function scoreMarkdownSections(markdown: string | undefined, sections: string[]): number {
  if (!markdown) {
    return 0;
  }

  const present = sections.filter((section) => markdown.includes(section)).length;
  const sectionScore = present / sections.length;
  const lengthScore = Math.min(markdown.trim().length / 1200, 1);
  return round(sectionScore * 0.75 + lengthScore * 0.25);
}

function buildFindings(loaded: LoadedRun, failedChecks: string[]): string[] {
  const findings: string[] = [];

  if (failedChecks.length === 0) {
    findings.push("All required structured artifacts are readable and schema-valid.");
  }

  if (loaded.claims) {
    findings.push(`Claim graph contains ${loaded.claims.claims.length} claims and ${loaded.claims.edges.length} edges.`);
  }

  if (loaded.evidence) {
    findings.push(`Evidence map contains ${loaded.evidence.evidence.length} evidence items.`);
  }

  if (loaded.sourceInventory?.sources.length) {
    findings.push(`Source inventory contains ${loaded.sourceInventory.sources.length} source-backed inputs.`);
  }

  if (loaded.sourceChunks?.chunks.length) {
    findings.push(`Source chunks contain ${loaded.sourceChunks.chunks.length} verifiable text chunks.`);
  }

  if (loaded.contradictions?.unsupported_critical_claims.length) {
    findings.push("Unsupported critical claims are explicitly surfaced instead of hidden in the memo.");
  }

  if (loaded.evidence?.evidence.some((item) => item.limitations.toLowerCase().includes("placeholder"))) {
    findings.push("Source quality is intentionally limited because deterministic v0.1 uses placeholder offline evidence.");
  }

  return findings;
}

function buildRecommendations(loaded: LoadedRun, failedChecks: string[]): string[] {
  const recommendations: string[] = [];

  if (failedChecks.length > 0) {
    recommendations.push("Fix missing or invalid artifacts before interpreting the decision memo.");
  }

  if (loaded.evidence?.evidence.some((item) => item.source_type === "model_output")) {
    recommendations.push("Replace model-output evidence with live sources, uploaded documents, or expert notes for real decisions.");
  }

  recommendations.push("Add memo-to-claim faithfulness checks before using generated prose as a final answer.");
  recommendations.push("Create golden benchmark inputs and compare eval scores across harness versions.");

  return recommendations;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
