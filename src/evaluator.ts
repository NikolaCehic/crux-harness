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
  UncertaintyArtifact
} from "./types.js";
import { buildEvalCouncil } from "./eval-council.js";
import { ArtifactValidator, schemaIds } from "./validator.js";

type LoadedRun = {
  runConfig?: RunConfig;
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
  const claimGraphFailures = findClaimGraphFailures(loaded.claims, loaded.evidence, loaded.contradictions);
  const faithfulness = analyzeFaithfulness(loaded);
  const failedChecks = [...loaded.failedChecks, ...validationFailures, ...claimGraphFailures, ...faithfulness.failures];

  const scores = {
    schema_validity: validationFailures.length === 0 && loaded.failedChecks.length === 0 ? 1 : 0,
    claim_graph_integrity: claimGraphFailures.length === 0 ? 1 : 0,
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
    faithfulness: faithfulness.score,
    crux_quality: scoreCruxQuality(loaded),
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

  const findings = buildFindings(loaded, failedChecks, faithfulness.findings);
  const improvement_recommendations = buildRecommendations(loaded, failedChecks);
  const council = buildEvalCouncil({
    ...loaded,
    scores,
    failedChecks
  });

  return {
    scores,
    findings,
    failed_checks: failedChecks,
    improvement_recommendations,
    council
  };
}

async function loadRun(runDir: string): Promise<LoadedRun> {
  const failedChecks: string[] = [];

  const [runConfig, questionSpec, sourceInventory, sourceChunks, claims, evidence, contradictions, uncertainty, redTeam, decisionMemo] = await Promise.all([
    readJson<RunConfig>(runDir, "run_config.json", failedChecks),
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

  return { runConfig, questionSpec, sourceInventory, sourceChunks, claims, evidence, contradictions, uncertainty, redTeam, decisionMemo, failedChecks };
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
    ["run_config.json", schemaIds.runConfig, loaded.runConfig],
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

function findClaimGraphFailures(claims?: ClaimsArtifact, evidence?: EvidenceArtifact, contradictions?: ContradictionsArtifact): string[] {
  if (!claims) {
    return [];
  }

  const failures: string[] = [];
  const claimIds = new Set(claims.claims.map((claim) => claim.id));
  const evidenceIds = new Set((evidence?.evidence ?? []).map((item) => item.id));
  const dependencyMap = new Map(claims.claims.map((claim) => [claim.id, claim.depends_on]));

  if (claimIds.size !== claims.claims.length) {
    failures.push("claim graph integrity: duplicate claim IDs.");
  }

  if (claims.root_claim_ids.length === 0) {
    failures.push("claim graph integrity: at least one root claim is required.");
  }

  for (const rootId of claims.root_claim_ids) {
    if (!claimIds.has(rootId)) {
      failures.push(`claim graph integrity: unknown root claim ${rootId}.`);
    }
  }

  for (const claim of claims.claims) {
    if (claim.depends_on.includes(claim.id)) {
      failures.push(`claim graph integrity: claim ${claim.id} depends on itself.`);
    }
    for (const dependency of claim.depends_on) {
      if (!claimIds.has(dependency)) {
        failures.push(`claim graph integrity: claim ${claim.id} depends on unknown claim ${dependency}.`);
      }
    }
    for (const evidenceId of [...claim.evidence_ids, ...claim.counterevidence_ids]) {
      if (evidence && !evidenceIds.has(evidenceId)) {
        failures.push(`claim graph integrity: claim ${claim.id} references unknown evidence ${evidenceId}.`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (claimId: string, trail: string[]): void => {
    if (visiting.has(claimId)) {
      failures.push(`claim graph integrity: dependency cycle detected (${[...trail, claimId].join(" -> ")}).`);
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

  for (const item of evidence?.evidence ?? []) {
    for (const claimId of [...item.supports_claim_ids, ...item.challenges_claim_ids]) {
      if (!claimIds.has(claimId)) {
        failures.push(`claim graph integrity: evidence ${item.id} references unknown claim ${claimId}.`);
      }
    }
  }

  for (const contradiction of contradictions?.contradictions ?? []) {
    for (const claimId of contradiction.claim_ids) {
      if (!claimIds.has(claimId)) {
        failures.push(`claim graph integrity: contradiction ${contradiction.id} references unknown claim ${claimId}.`);
      }
    }
  }

  return [...new Set(failures)];
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

function analyzeFaithfulness(loaded: LoadedRun): { score: number; failures: string[]; findings: string[] } {
  if (!loaded.decisionMemo || !loaded.claims) {
    return {
      score: 0,
      failures: ["faithfulness: decision memo or claims artifact is missing."],
      findings: []
    };
  }

  const failures: string[] = [];
  const findings: string[] = [];
  const memo = loaded.decisionMemo.toLowerCase();
  const forbiddenPhrases = [
    "guaranteed",
    "no risk",
    "risk-free",
    "certain to succeed",
    "must commit immediately",
    "full commitment immediately",
    "will definitely"
  ];

  for (const phrase of forbiddenPhrases) {
    if (memo.includes(phrase)) {
      failures.push(`faithfulness: memo uses unsupported certainty phrase "${phrase}".`);
    }
  }

  const decisionClaims = loaded.claims.claims.filter((claim) => loaded.claims?.root_claim_ids.includes(claim.id) || claim.type === "decision");
  const hasDecisionClaim = decisionClaims.some((claim) => normalizedIncludes(loaded.decisionMemo ?? "", claim.text));
  if (!hasDecisionClaim) {
    failures.push("faithfulness: memo recommendation does not match any root or decision claim.");
  }

  const keyClaimBullets = extractSectionBullets(loaded.decisionMemo, "## Key Claims");
  const unsupportedBullets = keyClaimBullets.filter((bullet) => {
    return !loaded.claims?.claims.some((claim) => tokenOverlap(bullet, claim.text) >= 0.55);
  });
  if (unsupportedBullets.length > 0) {
    failures.push(`faithfulness: key claim bullets do not map to claims.json: ${unsupportedBullets.join(" | ")}`);
  } else if (keyClaimBullets.length > 0) {
    findings.push(`Memo key-claim section maps ${keyClaimBullets.length} bullets back to claims.json.`);
  }

  if (loaded.evidence?.evidence.length && !loaded.decisionMemo.includes("source_inventory.json")) {
    failures.push("faithfulness: memo discusses evidence quality without pointing to source_inventory.json.");
  }

  return {
    score: round(Math.max(0, 1 - failures.length * 0.25)),
    failures,
    findings
  };
}

function scoreCruxQuality(loaded: LoadedRun): number {
  const checks = [
    loaded.contradictions ? loaded.contradictions.contradictions.some((item) => item.severity === "high") : false,
    loaded.uncertainty ? loaded.uncertainty.what_would_change_my_mind.length >= 4 : false,
    loaded.uncertainty ? loaded.uncertainty.recommended_tests.length >= 4 : false,
    loaded.redTeam ? loaded.redTeam.includes("## Recommendation Impact") : false,
    loaded.decisionMemo ? loaded.decisionMemo.includes("## What Would Change This Decision") : false,
    loaded.decisionMemo ? loaded.decisionMemo.includes("## Next Tests") : false
  ];

  return round(checks.filter(Boolean).length / checks.length);
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

function buildFindings(loaded: LoadedRun, failedChecks: string[], faithfulnessFindings: string[]): string[] {
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
    findings.push("Source quality is limited because the run uses placeholder offline evidence.");
  }

  findings.push(...faithfulnessFindings);

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

  if (!loaded.runConfig) {
    recommendations.push("Add run_config.json so replays lock harness version, mapper selection, prompts, and source policy.");
  }

  recommendations.push("Compare eval scores across harness versions before changing prompts or mappers.");

  return recommendations;
}

function extractSectionBullets(markdown: string, heading: string): string[] {
  const start = markdown.indexOf(heading);
  if (start === -1) {
    return [];
  }

  const afterHeading = markdown.slice(start + heading.length);
  const nextHeading = afterHeading.search(/\n## /);
  const section = nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function normalizedIncludes(text: string, target: string): boolean {
  return normalizeText(text).includes(normalizeText(target));
}

function tokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(tokenize(left));
  const rightTokens = new Set(tokenize(right));
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  const intersection = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
