import type {
  ClaimsArtifact,
  EvalCouncilDisagreement,
  EvalCouncilReport,
  EvalCouncilReview,
  EvalCouncilStatus,
  EvalReport,
  EvidenceArtifact,
  QuestionSpec,
  RunConfig,
  SourceInventory,
  UncertaintyArtifact
} from "./types.js";

export type EvalCouncilContext = {
  runConfig?: RunConfig;
  questionSpec?: QuestionSpec;
  sourceInventory?: SourceInventory;
  claims?: ClaimsArtifact;
  evidence?: EvidenceArtifact;
  uncertainty?: UncertaintyArtifact;
  redTeam?: string;
  decisionMemo?: string;
  scores: EvalReport["scores"];
  failedChecks: string[];
};

const councilSchemaVersion = "crux.eval_council.v1" as const;

export function buildEvalCouncil(context: EvalCouncilContext): EvalCouncilReport {
  const reviewerInputs = [
    reviewEvidence(context),
    reviewClaimGraph(context),
    reviewFaithfulness(context),
    reviewRedTeam(context),
    reviewUncertainty(context),
    reviewDecisionUtility(context),
    reviewDomain(context)
  ];
  const disagreements = buildDisagreements(reviewerInputs);
  const synthesis = synthesizeCouncil(reviewerInputs, disagreements);
  const synthesisReview = buildSynthesisReview(synthesis, reviewerInputs, disagreements);

  return {
    schema_version: councilSchemaVersion,
    reviewers: [...reviewerInputs, synthesisReview],
    disagreements,
    synthesis
  };
}

function reviewEvidence(context: EvalCouncilContext): EvalCouncilReview {
  const score = round((context.scores.evidence_traceability * 0.55) + (context.scores.source_quality * 0.45));
  const sourceCount = context.sourceInventory?.sources.length ?? 0;
  const sourceBackedEvidence = context.evidence?.evidence.filter((item) => (item.source_ids ?? []).length > 0).length ?? 0;
  const missingTraceability = context.claims?.claims.filter((claim) => {
    return claim.evidence_ids.length === 0 && claim.counterevidence_ids.length === 0 && !["unsupported", "unknown"].includes(claim.status);
  }) ?? [];
  const status = missingTraceability.length > 0 ? "fail" : statusFromScore(score, 0.78, 0.62);

  return {
    role_id: "evidence_auditor",
    role_name: "Evidence Auditor",
    status,
    score,
    stage: "gather_evidence",
    findings: [
      `Evidence traceability score is ${context.scores.evidence_traceability}.`,
      `Source quality score is ${context.scores.source_quality}.`,
      sourceCount > 0
        ? `${sourceBackedEvidence} evidence items cite source IDs from ${sourceCount} ingested sources.`
        : "No source pack was ingested for this run."
    ],
    blocking_failures: [
      ...missingTraceability.map((claim) => `Claim ${claim.id} lacks evidence despite status ${claim.status}.`),
      ...(score < 0.62 ? ["Evidence traceability and source quality are below the council failure threshold."] : [])
    ],
    recommendations: status === "pass"
      ? ["Keep evidence IDs, excerpts, and source chunks locked in the run contract."]
      : ["Add source-backed evidence for supported or contested claims before trusting the memo."]
  };
}

function reviewClaimGraph(context: EvalCouncilContext): EvalCouncilReview {
  const score = round((context.scores.claim_graph_integrity * 0.65) + (context.scores.claim_coverage * 0.35));
  const graphFailures = context.failedChecks.filter((check) => check.toLowerCase().includes("claim graph"));
  const rootCount = context.claims?.root_claim_ids.length ?? 0;
  const edgeCount = context.claims?.edges.length ?? 0;
  const status = graphFailures.length > 0 ? "fail" : statusFromScore(score, 0.82, 0.65);

  return {
    role_id: "claim_graph_auditor",
    role_name: "Claim Graph Auditor",
    status,
    score,
    stage: "build_claim_graph",
    findings: [
      `Claim graph integrity score is ${context.scores.claim_graph_integrity}.`,
      `Claim coverage score is ${context.scores.claim_coverage}.`,
      `Claim graph has ${rootCount} root claims and ${edgeCount} edges.`
    ],
    blocking_failures: graphFailures,
    recommendations: status === "pass"
      ? ["Keep root decision claims explicit and connected to supporting claims."]
      : ["Repair claim IDs, dependencies, roots, and evidence references before rerunning evaluation."]
  };
}

function reviewFaithfulness(context: EvalCouncilContext): EvalCouncilReview {
  const faithfulnessFailures = context.failedChecks.filter((check) => check.toLowerCase().includes("faithfulness"));
  const status = faithfulnessFailures.length > 0 ? "fail" : statusFromScore(context.scores.faithfulness, 0.9, 0.75);

  return {
    role_id: "faithfulness_auditor",
    role_name: "Faithfulness Auditor",
    status,
    score: context.scores.faithfulness,
    stage: "write_decision_memo",
    findings: [
      `Memo faithfulness score is ${context.scores.faithfulness}.`,
      `${faithfulnessFailures.length} faithfulness failures were detected.`
    ],
    blocking_failures: faithfulnessFailures,
    recommendations: status === "pass"
      ? ["Keep memo conclusions mapped to claims.json and cited evidence."]
      : ["Rewrite unsupported memo conclusions so each key claim maps back to claims.json."]
  };
}

function reviewRedTeam(context: EvalCouncilContext): EvalCouncilReview {
  const hasImpactSection = Boolean(context.redTeam?.includes("## Recommendation Impact"));
  const status = !hasImpactSection || context.scores.red_team_strength < 0.65
    ? "fail"
    : statusFromScore(context.scores.red_team_strength, 0.85, 0.65);

  return {
    role_id: "red_team_auditor",
    role_name: "Red Team Auditor",
    status,
    score: context.scores.red_team_strength,
    stage: "red_team",
    findings: [
      `Red-team strength score is ${context.scores.red_team_strength}.`,
      hasImpactSection ? "Red-team output includes recommendation impact." : "Red-team output is missing recommendation impact."
    ],
    blocking_failures: status === "fail"
      ? ["Red-team output is too shallow to pressure-test the recommendation."]
      : [],
    recommendations: status === "pass"
      ? ["Keep opposing thesis, failure modes, missing evidence, and recommendation impact explicit."]
      : ["Expand the red team into concrete counterarguments, failure modes, missing evidence, and decision impact."]
  };
}

function reviewUncertainty(context: EvalCouncilContext): EvalCouncilReview {
  const uncertaintyCount = context.uncertainty?.key_uncertainties.length ?? 0;
  const testCount = context.uncertainty?.recommended_tests.length ?? 0;
  const status = uncertaintyCount < 3 || testCount === 0
    ? "fail"
    : statusFromScore(context.scores.uncertainty_quality, 0.85, 0.65);

  return {
    role_id: "uncertainty_auditor",
    role_name: "Uncertainty Auditor",
    status,
    score: context.scores.uncertainty_quality,
    stage: "model_uncertainty",
    findings: [
      `Uncertainty quality score is ${context.scores.uncertainty_quality}.`,
      `${uncertaintyCount} key uncertainties and ${testCount} recommended tests are present.`
    ],
    blocking_failures: status === "fail"
      ? ["Uncertainty output is missing specific uncertainties or recommended tests."]
      : [],
    recommendations: status === "pass"
      ? ["Keep uncertainties tied to impact, evidence needed, and next tests."]
      : ["Make uncertainties specific, decision-relevant, and linked to evidence-gathering tests."]
  };
}

function reviewDecisionUtility(context: EvalCouncilContext): EvalCouncilReview {
  const score = round((context.scores.decision_usefulness * 0.55) + (context.scores.crux_quality * 0.45));
  const hasNextTests = Boolean(context.decisionMemo?.includes("## Next Tests"));
  const status = !hasNextTests ? "fail" : statusFromScore(score, 0.85, 0.65);

  return {
    role_id: "decision_utility_auditor",
    role_name: "Decision Utility Auditor",
    status,
    score,
    stage: "write_decision_memo",
    findings: [
      `Decision usefulness score is ${context.scores.decision_usefulness}.`,
      `Crux quality score is ${context.scores.crux_quality}.`,
      hasNextTests ? "Decision memo includes next tests." : "Decision memo is missing next tests."
    ],
    blocking_failures: status === "fail"
      ? ["Decision memo does not provide enough concrete next action for a serious user."]
      : [],
    recommendations: status === "pass"
      ? ["Keep recommendation, crux, uncertainty, and next tests in the memo."]
      : ["Add a sharper recommendation, decision crux, what-would-change-it section, and next tests."]
  };
}

function reviewDomain(context: EvalCouncilContext): EvalCouncilReview {
  const sourceCount = context.sourceInventory?.sources.length ?? 0;
  const hasSourcePack = Boolean(context.runConfig?.source_pack);
  const hasScope = Boolean(context.questionSpec?.constraints.some((constraint) => constraint.startsWith("Analysis scope:")));
  const sourcePolicy = context.runConfig?.source_policy ?? "offline";
  const score = round((hasScope ? 0.45 : 0) + (hasSourcePack && sourceCount > 0 ? 0.45 : 0.22) + (sourcePolicy ? 0.1 : 0));
  const status: EvalCouncilStatus = sourcePolicy !== "offline" && sourceCount === 0
    ? "fail"
    : score >= 0.85
      ? "pass"
      : "warn";

  return {
    role_id: "domain_reviewer",
    role_name: "Domain Reviewer",
    status,
    score,
    stage: "normalize_question",
    findings: [
      hasScope ? "Question spec carries an explicit analysis scope." : "Question spec is missing an explicit analysis scope.",
      hasSourcePack ? `Run used a source pack with ${sourceCount} sources.` : "Run did not use a source pack.",
      `Source policy is ${sourcePolicy}.`
    ],
    blocking_failures: status === "fail"
      ? [`Source policy ${sourcePolicy} requires evidence beyond an empty source inventory.`]
      : [],
    recommendations: status === "pass"
      ? ["Keep scope-specific source packs attached to serious runs."]
      : ["Attach a vertical or project source pack when using Crux for production decisions."]
  };
}

function buildDisagreements(reviews: EvalCouncilReview[]): EvalCouncilDisagreement[] {
  const byRole = new Map(reviews.map((review) => [review.role_id, review]));
  const disagreements: EvalCouncilDisagreement[] = [];
  const redTeam = byRole.get("red_team_auditor");
  const decision = byRole.get("decision_utility_auditor");
  const uncertainty = byRole.get("uncertainty_auditor");
  const evidence = byRole.get("evidence_auditor");
  const faithfulness = byRole.get("faithfulness_auditor");

  if (redTeam && decision && redTeam.status === "fail" && decision.status === "pass") {
    disagreements.push({
      topic: "red-team-vs-decision-utility",
      severity: "high",
      positions: [
        {
          role_id: redTeam.role_id,
          status: redTeam.status,
          position: "The recommendation has not been pressure-tested strongly enough."
        },
        {
          role_id: decision.role_id,
          status: decision.status,
          position: "The decision memo remains action-oriented and complete."
        }
      ]
    });
  }

  if (uncertainty && decision && uncertainty.status !== "pass" && decision.status === "pass") {
    disagreements.push({
      topic: "uncertainty-vs-decision-utility",
      severity: uncertainty.status === "fail" ? "high" : "medium",
      positions: [
        {
          role_id: uncertainty.role_id,
          status: uncertainty.status,
          position: "The uncertainty model needs sharper assumptions or tests."
        },
        {
          role_id: decision.role_id,
          status: decision.status,
          position: "The memo is still formatted for action."
        }
      ]
    });
  }

  if (faithfulness && evidence && faithfulness.status === "fail" && evidence.status === "pass") {
    disagreements.push({
      topic: "faithfulness-vs-evidence-quality",
      severity: "high",
      positions: [
        {
          role_id: faithfulness.role_id,
          status: faithfulness.status,
          position: "The memo overstates or adds unsupported conclusions."
        },
        {
          role_id: evidence.role_id,
          status: evidence.status,
          position: "The underlying evidence map is structurally traceable."
        }
      ]
    });
  }

  return disagreements;
}

function synthesizeCouncil(
  reviews: EvalCouncilReview[],
  disagreements: EvalCouncilDisagreement[]
): EvalCouncilReport["synthesis"] {
  const blockingFailures = reviews.flatMap((review) => review.blocking_failures);
  const statuses = reviews.map((review) => review.status);
  const status: EvalCouncilStatus = blockingFailures.length > 0 || statuses.includes("fail")
    ? "fail"
    : statuses.includes("warn") || disagreements.length > 0
      ? "warn"
      : "pass";
  const averageScore = round(reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length);
  const confidence = status === "pass"
    ? averageScore
    : round(Math.min(averageScore, blockingFailures.length > 0 ? 0.55 : 0.75));
  const nextFixes = reviews
    .filter((review) => review.status !== "pass")
    .flatMap((review) => review.recommendations)
    .slice(0, 5);

  return {
    status,
    confidence,
    blocking_failures: [...new Set(blockingFailures)],
    next_fixes: nextFixes.length > 0 ? nextFixes : ["No blocking fixes required; monitor benchmark trends before changing prompts or mappers."]
  };
}

function buildSynthesisReview(
  synthesis: EvalCouncilReport["synthesis"],
  reviews: EvalCouncilReview[],
  disagreements: EvalCouncilDisagreement[]
): EvalCouncilReview {
  return {
    role_id: "synthesis_judge",
    role_name: "Synthesis Judge",
    status: synthesis.status,
    score: synthesis.confidence,
    stage: "evaluate",
    findings: [
      `${reviews.filter((review) => review.status === "pass").length}/${reviews.length} specialist reviewers passed.`,
      `${synthesis.blocking_failures.length} blocking failures were found.`,
      `${disagreements.length} council disagreements were preserved.`
    ],
    blocking_failures: synthesis.blocking_failures,
    recommendations: synthesis.next_fixes
  };
}

function statusFromScore(score: number, warnThreshold: number, failThreshold: number): EvalCouncilStatus {
  if (score < failThreshold) {
    return "fail";
  }
  if (score < warnThreshold) {
    return "warn";
  }
  return "pass";
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
