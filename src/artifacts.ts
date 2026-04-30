import type {
  Claim,
  ClaimsArtifact,
  ContradictionsArtifact,
  EvalReport,
  EvidenceArtifact,
  QuestionSpec,
  RunInput,
  SourceChunksArtifact,
  SourceInventory,
  UncertaintyArtifact
} from "./types.js";
import { buildEvalCouncil } from "./eval-council.js";
import { mapSourceGroundedEvidence } from "./evidence-mapper.js";

type ScopeProfile = {
  scope: string;
  decisionType: string;
  owner: string;
  subject: string;
  opportunity: string;
  differentiator: string;
  primaryRisk: string;
  executionRisk: string;
  adoptionBlocker: string;
  validationTest: string;
  externalPressure: string;
  cruxCondition: string;
  stagedRecommendation: string;
  redTeamThesis: string;
  requiredEvidence: string[];
};

export function buildQuestionSpec(input: RunInput): QuestionSpec {
  const profile = getScopeProfile(input);

  return {
    question: input.question,
    decision_type: profile.decisionType,
    decision_owner: profile.owner,
    context: input.decision_context,
    time_horizon: input.time_horizon,
    success_criteria: [
      "Decision can be acted on within the stated time horizon.",
      "Critical assumptions are explicit and testable.",
      "Recommendation includes conditions that would change the decision.",
      "Evidence quality is separated from persuasive prose.",
      `${profile.subject} is evaluated against the stated context instead of generic advice.`
    ],
    constraints: [
      ...(input.known_constraints ?? []),
      `Risk tolerance: ${input.risk_tolerance ?? "unspecified"}`,
      `Geography: ${input.geography ?? "unspecified"}`,
      `Analysis scope: ${profile.scope}`
    ],
    unknowns: [
      `Whether ${profile.cruxCondition}.`,
      `Whether ${profile.primaryRisk.toLowerCase()}.`,
      `Whether ${profile.executionRisk.toLowerCase()}.`,
      `Whether ${profile.externalPressure.toLowerCase()} within the time horizon.`
    ],
    required_artifacts: [
      "run_config.json",
      "source_inventory.json",
      "source_chunks.json",
      "claims.json",
      "evidence.json",
      "contradictions.json",
      "red_team.md",
      "uncertainty.json",
      "decision_memo.md",
      "eval_report.json"
    ]
  };
}

export function buildClaims(input: RunInput): ClaimsArtifact {
  const profile = getScopeProfile(input);
  const claims = [
    claim("C1", `${profile.stagedRecommendation}`, "decision", "contested", 1, 0.6, ["C2", "C3", "C4", "C5"], ["E1", "E2", "E7"], ["E5"], "Root decision claim; depends on demand, differentiation, execution feasibility, and risk."),
    claim("C2", `${profile.opportunity}`, "descriptive", "weakly_supported", 0.9, 0.68, [], ["E1", "E2"], [], "Opportunity appears plausible but needs direct validation."),
    claim("C3", `${profile.differentiator}`, "causal", "weakly_supported", 0.86, 0.62, [], ["E3", "E7"], ["E5"], "Potential advantage exists, but durability is not yet proven."),
    claim("C4", `${profile.primaryRisk}`, "descriptive", "supported", 0.88, 0.74, [], ["E4", "E5"], [], "This is a major strategic risk that should remain visible."),
    claim("C5", `${profile.executionRisk}`, "predictive", "contested", 0.84, 0.56, [], ["E5"], ["E2"], "Execution feasibility is one of the most important uncertainties."),
    claim("C6", `${profile.subject} should be tested through a narrow staged commitment before a full irreversible decision.`, "normative", "supported", 0.82, 0.72, ["C3", "C4", "C5"], ["E3", "E6", "E7"], [], "A staged test reduces scope, speeds validation, and limits downside."),
    claim("C7", `${profile.adoptionBlocker}`, "causal", "weakly_supported", 0.8, 0.66, [], ["E3", "E7"], [], "This blocker should shape the first validation test."),
    claim("C8", `A broad generic approach to ${profile.subject} is unlikely to be a durable advantage without a specific wedge.`, "comparative", "supported", 0.78, 0.73, ["C4"], ["E4", "E5"], [], "Broad positioning is easier to copy, ignore, or politically dilute."),
    claim("C9", `${profile.validationTest} is the fastest practical way to reduce decision uncertainty.`, "causal", "supported", 0.76, 0.75, ["C2", "C5"], ["E6", "E8"], [], "The test attacks the highest-value unknowns directly."),
    claim("C10", `The decision should defer full commitment until ${profile.validationTest.toLowerCase()} produces clear evidence.`, "decision", "supported", 0.86, 0.7, ["C6", "C9"], ["E6", "E8"], [], "This converts the analysis into a staged decision."),
    claim("C11", `If ${profile.externalPressure}, the standalone case for ${profile.subject} becomes weaker.`, "predictive", "weakly_supported", 0.74, 0.62, ["C4"], ["E4", "E5"], [], "External pressure is probable but its impact must be scoped."),
    claim("C12", `${profile.subject} is attractive only if ${profile.cruxCondition}.`, "decision", "contested", 0.9, 0.6, ["C2", "C3", "C4", "C5", "C7"], ["E3", "E7", "E8"], ["E5"], "This is the practical crux of the decision.")
  ];

  return {
    claims,
    edges: [
      edge("C2", "C1", "supports"),
      edge("C3", "C1", "supports"),
      edge("C4", "C1", "challenges"),
      edge("C5", "C1", "challenges"),
      edge("C3", "C6", "supports"),
      edge("C4", "C6", "supports"),
      edge("C5", "C6", "supports"),
      edge("C4", "C8", "supports"),
      edge("C2", "C9", "supports"),
      edge("C5", "C9", "supports"),
      edge("C6", "C10", "supports"),
      edge("C9", "C10", "supports"),
      edge("C4", "C11", "causes"),
      edge("C7", "C12", "supports"),
      edge("C5", "C12", "challenges")
    ],
    root_claim_ids: ["C1", "C10", "C12"]
  };
}

export function buildEvidence(input: RunInput, sourceInventory?: SourceInventory, sourceChunks?: SourceChunksArtifact): EvidenceArtifact {
  if (sourceInventory && sourceInventory.sources.length > 0) {
    if (!sourceChunks) {
      throw new Error("Source-grounded evidence requires source chunks.");
    }

    return mapSourceGroundedEvidence(input, sourceInventory, sourceChunks);
  }

  return buildPlaceholderEvidence(input);
}

export function buildPlaceholderEvidence(input: RunInput): EvidenceArtifact {
  const profile = getScopeProfile(input);

  return {
    evidence: [
      evidence("E1", "model_output", `${profile.scope} opportunity hypothesis placeholder`, `${profile.opportunity}`, ["C2"], [], 0.45, 0.55, 0.72, "Offline stub evidence; must be replaced by live sources before real decisions."),
      evidence("E2", "expert_input", `${profile.scope} discovery notes placeholder`, `${profile.cruxCondition} may hold if direct stakeholder discovery confirms urgency, budget, and implementation feasibility.`, ["C2", "C5"], [], 0.5, 0.5, 0.68, "Placeholder for actual interviews, source documents, or operational data."),
      evidence("E3", "model_output", `${profile.scope} wedge analysis placeholder`, `${profile.differentiator}`, ["C3", "C6", "C7", "C12"], [], 0.48, 0.6, 0.78, "Needs validation against real user, market, technical, or policy evidence."),
      evidence("E4", "model_output", `${profile.scope} external pressure placeholder`, `${profile.externalPressure} could compress the upside or change the implementation path.`, ["C4", "C8", "C11"], [], 0.52, 0.58, 0.76, "General strategic prior rather than sourced proof."),
      evidence("E5", "model_output", `${profile.scope} risk placeholder`, `${profile.primaryRisk} ${profile.executionRisk}`, ["C4", "C5"], ["C1", "C3", "C12"], 0.55, 0.56, 0.82, "Requires scope-specific evidence before a real decision."),
      evidence("E6", "calculation", `${profile.scope} staged validation logic`, `A narrow staged test lets the decision maker validate ${profile.subject} faster and with lower downside than a full commitment.`, ["C6", "C9", "C10"], [], 0.6, 0.7, 0.8, "Reasoned calculation, not empirical proof."),
      evidence("E7", "model_output", `${profile.scope} adoption blocker hypothesis`, `${profile.adoptionBlocker}`, ["C3", "C7", "C12"], [], 0.5, 0.62, 0.78, "Needs source-backed validation."),
      evidence("E8", "expert_input", `${profile.scope} validation plan placeholder`, `${profile.validationTest} can reveal whether ${profile.cruxCondition}.`, ["C9", "C10", "C12"], [], 0.58, 0.66, 0.74, "Assumes access to qualified evidence and stakeholders.")
    ]
  };
}

export function buildContradictions(input: RunInput): ContradictionsArtifact {
  const profile = getScopeProfile(input);

  return {
    contradictions: [
      {
        id: "K1",
        claim_ids: ["C2", "C5"],
        description: `The opportunity for ${profile.subject} can be real while execution feasibility remains too weak for the stated horizon.`,
        severity: "high",
        resolution_status: "unresolved",
        next_step: profile.validationTest
      },
      {
        id: "K2",
        claim_ids: ["C3", "C4", "C8"],
        description: `A plausible wedge may still be overwhelmed if ${profile.primaryRisk.toLowerCase()}.`,
        severity: "high",
        resolution_status: "partially_resolved",
        next_step: `Define the narrowest test that proves ${profile.cruxCondition}.`
      },
      {
        id: "K3",
        claim_ids: ["C1", "C12"],
        description: `The broad decision is weaker than the staged decision until ${profile.validationTest.toLowerCase()} produces evidence.`,
        severity: "medium",
        resolution_status: "partially_resolved",
        next_step: "Stage the decision and revisit after the first validation cycle."
      }
    ],
    unsupported_critical_claims: ["C2", "C3", "C5", "C12"],
    missing_evidence: profile.requiredEvidence
  };
}

export function buildRedTeam(input: RunInput): string {
  const profile = getScopeProfile(input);

  return `## Opposing Thesis

${profile.redTeamThesis}

## Strongest Counterarguments

1. The apparent opportunity may not translate into urgent action by the relevant stakeholders.
2. The proposed wedge may be weaker than expected once real-world constraints are included.
3. ${profile.primaryRisk}
4. ${profile.executionRisk}
5. The decision maker may overcommit before validating the narrowest testable version of the thesis.

## Failure Modes

- The team optimizes for a persuasive narrative instead of hard evidence.
- The first validation test is too broad to change the decision.
- Stakeholder incentives or implementation constraints dominate the theoretical upside.
- ${profile.externalPressure}

## Missing Evidence

${profile.requiredEvidence.map((item) => `- ${item}`).join("\n")}

## Recommendation Impact

The red-team case weakens any recommendation to fully commit immediately. It supports a staged strategy: run ${profile.validationTest.toLowerCase()}, then expand only if the evidence shows that ${profile.cruxCondition}.
`;
}

export function buildUncertainty(input: RunInput): UncertaintyArtifact {
  const profile = getScopeProfile(input);

  return {
    overall_confidence: 0.62,
    key_uncertainties: [
      uncertainty("U1", "Stakeholder urgency", `Meaningful interest in ${profile.subject}, uncertain near-term commitment`, 0.55, "If urgency is low, the decision should be deferred or narrowed.", "Direct evidence of budget, authority, urgency, or operational need."),
      uncertainty("U2", "Execution feasibility", profile.executionRisk, 0.5, "If execution is harder than expected, the staged path should shrink further.", "Measured implementation path and concrete constraints."),
      uncertainty("U3", "Durable wedge", profile.differentiator, 0.58, "If the wedge is shallow, the upside compresses.", "Competitive, technical, operational, or policy comparison."),
      uncertainty("U4", "Repeatability", `Unknown whether ${profile.cruxCondition}`, 0.52, "If the pattern is not repeatable, the strategy becomes bespoke or low-leverage.", "Multiple comparable tests in the same scope."),
      uncertainty("U5", "External pressure", profile.externalPressure, 0.6, "If external pressure is strong, the recommendation should become more conservative.", "Evidence about incumbent, market, political, scientific, or operational dynamics.")
    ],
    sensitivity: [
      {
        assumption: `${profile.validationTest} can produce evidence inside the time horizon.`,
        low_case: "The test produces ambiguous or delayed evidence.",
        base_case: "The test resolves the top two uncertainties.",
        high_case: "The test produces strong evidence for a staged commitment.",
        decision_impact: "This assumption controls whether to proceed, defer, or abandon."
      },
      {
        assumption: profile.cruxCondition,
        low_case: "The crux condition does not hold.",
        base_case: "The crux condition holds for a narrow segment.",
        high_case: "The crux condition holds broadly and repeatably.",
        decision_impact: "High case supports expansion; low case supports rejection or redesign."
      }
    ],
    what_would_change_my_mind: [
      `Strong evidence that ${profile.cruxCondition}.`,
      `Evidence that ${profile.primaryRisk.toLowerCase()} is less severe than expected.`,
      `Evidence that ${profile.executionRisk.toLowerCase()} can be managed within the time horizon.`,
      `Evidence that ${profile.externalPressure.toLowerCase()} is not decisive.`,
      `A failed ${profile.validationTest.toLowerCase()} would weaken the recommendation.`
    ],
    recommended_tests: [
      profile.validationTest,
      `Collect direct evidence for whether ${profile.cruxCondition}.`,
      "Build a comparison matrix against the strongest alternative options.",
      "Identify the cheapest test that could reverse the recommendation.",
      "Re-run the decision memo after evidence from the first validation cycle."
    ]
  };
}

export function buildDecisionMemo(input: RunInput): string {
  const profile = getScopeProfile(input);

  const evidenceMode = input.source_pack
    ? "The current source-grounded evidence supports a structured hypothesis, not a final answer."
    : "The current offline evidence supports a structured hypothesis, not a final answer.";

  return `## Recommendation

${profile.stagedRecommendation}

## Executive Summary

The current analysis supports a conditional, staged approach to ${profile.subject}. The opportunity is plausible: ${profile.opportunity} The risk is also material: ${profile.primaryRisk} The best next move is not a full commitment. It is to run ${profile.validationTest.toLowerCase()} and use the result to update the decision.

## Core Reasoning

The decision depends on whether ${profile.cruxCondition} within the ${input.time_horizon} horizon. ${evidenceMode} Crux therefore recommends explicit tests, visible uncertainty, and a decision review after the first validation cycle.

## Key Claims

- ${profile.opportunity}
- ${profile.differentiator}
- ${profile.primaryRisk}
- ${profile.executionRisk}
- ${profile.adoptionBlocker}
- ${profile.subject} is attractive only if ${profile.cruxCondition}.

## Evidence Quality

Evidence quality depends on the available sources. Source-pack runs use local cited material and preserve provenance in source_inventory.json; non-source-pack runs still use deterministic placeholder evidence. A real recommendation should still add live sources, uploaded documents, stakeholder interviews, datasets, or expert review depending on the scope.

## Red-Team Findings

The strongest objection is: ${profile.redTeamThesis} This weakens any immediate full-commitment recommendation and strengthens a staged validation path.

## Uncertainty

Overall confidence: 0.62.

The largest uncertainty is whether ${profile.cruxCondition}. The second major uncertainty is whether ${profile.executionRisk.toLowerCase()}.

## What Would Change This Decision

- Strong evidence from ${profile.validationTest.toLowerCase()} would strengthen the case to proceed.
- Evidence that ${profile.primaryRisk.toLowerCase()} is severe would weaken the case.
- Evidence that ${profile.externalPressure.toLowerCase()} is decisive would weaken the case.
- Evidence that the crux condition is repeatable would support expansion.

## Next Tests

1. ${profile.validationTest}
2. Collect the missing evidence listed in contradictions.json.
3. Build a comparison matrix against alternative choices.
4. Identify the fastest test that could falsify the recommendation.
5. Re-run Crux after the validation cycle.
`;
}

export function buildInitialEvalReport(): EvalReport {
  const scores: EvalReport["scores"] = {
    schema_validity: 1,
    claim_graph_integrity: 1,
    claim_coverage: 0.82,
    evidence_traceability: 0.76,
    source_quality: 0.42,
    contradiction_handling: 0.8,
    red_team_strength: 0.78,
    uncertainty_quality: 0.84,
    faithfulness: 0.8,
    crux_quality: 0.78,
    decision_usefulness: 0.86
  };
  const findings = [
    "The run produced the required artifact shape and a complete deterministic reasoning path.",
    "Source quality is intentionally limited because v0.1 uses offline placeholder evidence.",
    "The recommendation is conditional and exposes what would change the decision."
  ];
  const failedChecks: string[] = [];

  return {
    scores,
    findings,
    failed_checks: failedChecks,
    improvement_recommendations: [
      "Replace placeholder evidence with live web research and uploaded source documents.",
      "Add evaluator checks that compare memo claims against claim IDs.",
      "Add golden benchmark tasks before tuning agent prompts."
    ],
    council: buildEvalCouncil({ scores, failedChecks })
  };
}

function getScopeProfile(input: RunInput): ScopeProfile {
  const scope = normalizeScope(input.analysis_scope ?? input.scenario_id ?? inferScope(input.question));
  const profiles = buildProfiles();
  return profiles[scope] ?? profiles["strategic-tech"];
}

function normalizeScope(scope: string): string {
  return scope.toLowerCase().trim().replace(/_/g, "-");
}

function inferScope(question: string): string {
  const lower = question.toLowerCase();
  if (lower.includes("invest") || lower.includes("fund")) return "investment-diligence";
  if (lower.includes("city") || lower.includes("subsid")) return "policy-analysis";
  if (lower.includes("copilot") || lower.includes("product")) return "product-strategy";
  if (lower.includes("retrieval") || lower.includes("rag") || lower.includes("context window")) return "scientific-thesis";
  if (lower.includes("market") || lower.includes("fintech")) return "market-entry";
  if (lower.includes("activation") || lower.includes("root-cause") || lower.includes("redesign")) return "root-cause-analysis";
  return "strategic-tech";
}

function buildProfiles(): Record<string, ScopeProfile> {
  return {
    "strategic-tech": {
      scope: "strategic-tech",
      decisionType: "strategic technology decision",
      owner: "technical founder or strategy lead",
      subject: "enterprise agent platform strategy",
      opportunity: "Enterprise buyers may have meaningful interest in an enterprise agent platform that automates multi-step operational work.",
      differentiator: "A startup can differentiate through reliability, evaluation, integrations, design partners, and domain-specific workflows.",
      primaryRisk: "The enterprise agent platform category is crowded and exposed to incumbent bundling pressure.",
      executionRisk: "Enterprise sales cycles may be too slow for a seed-stage startup that needs credible traction within 12 months.",
      adoptionBlocker: "Evaluation, observability, and failure recovery are likely adoption blockers for enterprise agent deployments.",
      validationTest: "Secure three budget-backed design partners for the same narrow workflow",
      externalPressure: "incumbents bundle sufficient agent capabilities into existing enterprise suites",
      cruxCondition: "design partners validate budget-backed demand for a repeatable workflow",
      stagedRecommendation: "Do not commit immediately to a broad enterprise agent platform; validate one narrow workflow with design partners first.",
      redTeamThesis: "The startup should not build a broad enterprise agent platform in 2026 because the category is crowded, distribution-heavy, and vulnerable to incumbent bundling.",
      requiredEvidence: [
        "Current buyer interviews with budget owners.",
        "Competitive feature map against incumbent AI platforms.",
        "Pilot conversion data for agent products in similar enterprise workflows.",
        "Security and procurement requirements for the target buyer segment."
      ]
    },
    "investment-diligence": {
      scope: "investment-diligence",
      decisionType: "investment diligence decision",
      owner: "fund analyst or investment committee",
      subject: "investment in the compliance automation startup",
      opportunity: "Compliance automation may reduce manual review work and create urgent value for regulated enterprises.",
      differentiator: "Automated evidence collection, audit trails, and domain-specific compliance workflows may create a defensible wedge.",
      primaryRisk: "The startup's compliance automation claims may not translate into durable revenue or defensible differentiation.",
      executionRisk: "Regulated buyers may require long security, legal, and procurement reviews before expanding usage.",
      adoptionBlocker: "Accuracy, liability, integration burden, and auditability are likely adoption blockers for compliance automation.",
      validationTest: "Complete reference calls, pipeline review, and one paid-pilot conversion analysis",
      externalPressure: "incumbent GRC and compliance platforms bundle comparable AI automation",
      cruxCondition: "budget-owning compliance teams validate measurable ROI and risk reduction",
      stagedRecommendation: "Proceed to deeper diligence only if customer evidence proves urgent compliance automation value and defensible differentiation.",
      redTeamThesis: "The fund should not advance the investment if the startup's AI compliance story is mostly narrative, with weak revenue proof and limited buyer urgency.",
      requiredEvidence: [
        "Customer references from budget-owning compliance leaders.",
        "Revenue quality, retention, and pilot-to-paid conversion data.",
        "Competitive comparison against incumbent GRC platforms.",
        "Evidence that automation accuracy satisfies audit and liability requirements."
      ]
    },
    "policy-analysis": {
      scope: "policy-analysis",
      decisionType: "policy analysis decision",
      owner: "city policy team",
      subject: "office-to-residential conversions subsidy",
      opportunity: "Office-to-residential conversions may add housing supply, reuse vacant office stock, and reduce housing costs in constrained cities.",
      differentiator: "Targeted subsidies can unlock projects that are economically infeasible under current zoning, financing, or building-code constraints.",
      primaryRisk: "High conversion costs, unsuitable building stock, zoning limits, and fiscal leakage may reduce housing impact.",
      executionRisk: "Permitting, financing, neighborhood politics, and construction timelines may delay units beyond the policy horizon.",
      adoptionBlocker: "Developer participation depends on predictable approvals, subsidy design, financing, and conversion economics.",
      validationTest: "Model conversion economics for a representative building set and run developer participation interviews",
      externalPressure: "alternative housing interventions produce more units per public dollar",
      cruxCondition: "subsidies unlock conversions that would not otherwise happen and produce cost-effective housing supply",
      stagedRecommendation: "Pilot a tightly targeted office-to-residential conversions subsidy before committing broad city funds.",
      redTeamThesis: "The city should not subsidize conversions broadly if the policy mainly transfers public money to projects that are costly, slow, or would have happened anyway.",
      requiredEvidence: [
        "Inventory of buildings physically suitable for conversion.",
        "Per-unit public cost compared with alternative housing interventions.",
        "Developer interviews on subsidy thresholds and permitting barriers.",
        "Projected affordability and displacement effects."
      ]
    },
    "product-strategy": {
      scope: "product-strategy",
      decisionType: "product strategy decision",
      owner: "B2B SaaS product leader",
      subject: "AI copilot versus workflow automation product bet",
      opportunity: "An AI copilot may improve perceived product value, while workflow automation may create measurable retention and expansion gains for B2B SaaS customers.",
      differentiator: "Deep workflow automation tied to existing customer jobs may be harder to copy than a generic AI copilot.",
      primaryRisk: "The AI copilot may be attractive for positioning but weaker than fixing existing workflow bottlenecks.",
      executionRisk: "Limited engineering capacity means building both the copilot and workflow automation could dilute quality and delay impact.",
      adoptionBlocker: "User trust, workflow fit, admin controls, and measurable time savings are likely adoption blockers.",
      validationTest: "Run customer discovery and prototype tests comparing copilot usage against workflow automation ROI",
      externalPressure: "competitors add generic AI copilots that reset buyer expectations",
      cruxCondition: "customers show higher willingness to pay or retention impact for one product path",
      stagedRecommendation: "Prioritize the path that wins customer ROI tests; avoid building an AI copilot just for positioning.",
      redTeamThesis: "The company should not default to an AI copilot if existing workflow automation would solve more painful problems and drive better retention.",
      requiredEvidence: [
        "Customer interviews segmented by job-to-be-done.",
        "Prototype usage data for copilot and workflow automation variants.",
        "Retention or expansion impact estimates.",
        "Competitive analysis of AI copilot table stakes."
      ]
    },
    "scientific-thesis": {
      scope: "scientific-thesis",
      decisionType: "technical thesis evaluation",
      owner: "applied AI research lead",
      subject: "retrieval-augmented generation necessity as context windows grow",
      opportunity: "Retrieval-augmented generation may remain necessary for freshness, citations, cost control, access control, and modular knowledge updates even as context windows grow.",
      differentiator: "Hybrid RAG and long-context systems can combine broad context with targeted retrieval, grounding, and governance.",
      primaryRisk: "Longer context windows and stronger model reasoning may reduce the need for traditional retrieval pipelines in some workloads.",
      executionRisk: "Maintaining retrieval infrastructure may add complexity if long-context performance is good enough for target use cases.",
      adoptionBlocker: "Freshness, provenance, permissions, evaluation, and latency are likely adoption blockers for replacing RAG entirely.",
      validationTest: "Benchmark RAG, long-context, and hybrid systems on freshness, citations, permissions, latency, and answer quality",
      externalPressure: "model providers make long-context inference cheaper and more reliable",
      cruxCondition: "target enterprise workloads still require retrieval for freshness, citations, permissions, or cost",
      stagedRecommendation: "Do not abandon RAG; benchmark hybrid retrieval-augmented generation against long-context baselines before changing infrastructure.",
      redTeamThesis: "The team should not keep investing in RAG by default if long-context models satisfy the relevant quality, cost, and governance requirements.",
      requiredEvidence: [
        "Benchmark results across RAG, long-context, and hybrid systems.",
        "Cost and latency measurements for target workloads.",
        "Failure analysis for freshness, citation, and permission errors.",
        "Customer or stakeholder requirements for provenance and access control."
      ]
    },
    "market-entry": {
      scope: "market-entry",
      decisionType: "market entry decision",
      owner: "fintech leadership team",
      subject: "European fintech entry into the US SMB lending market",
      opportunity: "The US SMB lending market is large and may reward better underwriting, faster decisions, and improved borrower experience.",
      differentiator: "A European fintech with strong underwriting technology may create an advantage if it adapts to US data, regulation, and distribution.",
      primaryRisk: "Regulatory complexity, credit risk, capital partnerships, and local distribution may dominate the technical underwriting advantage.",
      executionRisk: "Entering the US SMB lending market may require licenses, bank partners, compliance operations, and credit performance proof before scale.",
      adoptionBlocker: "Trust, capital availability, broker or platform distribution, and state-by-state compliance are likely adoption blockers.",
      validationTest: "Run a state-by-state regulatory review, capital partner diligence, and controlled credit-risk pilot",
      externalPressure: "US incumbents and embedded lending platforms capture the most attractive SMB borrowers",
      cruxCondition: "the fintech can secure compliant distribution and capital while maintaining underwriting edge",
      stagedRecommendation: "Do not enter the US SMB lending market broadly; validate regulation, capital partnerships, and credit performance in a narrow pilot first.",
      redTeamThesis: "The fintech should not enter the US SMB lending market if regulation, capital, and distribution erase its underwriting advantage.",
      requiredEvidence: [
        "State-by-state licensing and compliance requirements.",
        "Capital partner terms and constraints.",
        "Credit model validation on US SMB data.",
        "Distribution acquisition cost and borrower quality analysis."
      ]
    },
    "root-cause-analysis": {
      scope: "root-cause-analysis",
      decisionType: "root-cause analysis decision",
      owner: "growth and product team",
      subject: "activation drop after onboarding redesign",
      opportunity: "The activation drop can likely be diagnosed by comparing onboarding behavior, instrumentation, cohort mix, and user friction before and after the redesign.",
      differentiator: "A structured root-cause analysis can separate actual product friction from analytics artifacts or traffic-quality changes.",
      primaryRisk: "The onboarding redesign may be blamed incorrectly if instrumentation changes, cohort mix, or seasonality explain the activation drop.",
      executionRisk: "The team may roll back or iterate without isolating the causal mechanism behind the activation decline.",
      adoptionBlocker: "Event tracking quality, experiment design, segment-level behavior, and support-ticket themes are likely blockers to a confident diagnosis.",
      validationTest: "Compare funnel events, session recordings, support tickets, and cohort mix before and after the onboarding redesign",
      externalPressure: "traffic acquisition changes or instrumentation bugs explain the activation drop instead of product friction",
      cruxCondition: "the redesigned onboarding flow caused measurable friction in a specific user segment or step",
      stagedRecommendation: "Do not roll back blindly; diagnose the activation drop with segmented funnel, instrumentation, and session evidence first.",
      redTeamThesis: "The team should not assume the onboarding redesign caused the activation drop until instrumentation, traffic mix, and cohort effects are ruled out.",
      requiredEvidence: [
        "Segmented funnel comparison before and after the redesign.",
        "Instrumentation diff for activation events.",
        "Session recordings around the largest drop-off step.",
        "Support ticket and qualitative feedback themes."
      ]
    }
  };
}

function claim(
  id: string,
  text: string,
  type: Claim["type"],
  status: Claim["status"],
  importance: number,
  confidence: number,
  depends_on: string[],
  evidence_ids: string[],
  counterevidence_ids: string[],
  notes: string
): Claim {
  return { id, text, type, status, importance, confidence, depends_on, evidence_ids, counterevidence_ids, notes };
}

function edge(from: string, to: string, relation: ClaimsArtifact["edges"][number]["relation"]): ClaimsArtifact["edges"][number] {
  return { from, to, relation };
}

function evidence(
  id: string,
  source_type: EvidenceArtifact["evidence"][number]["source_type"],
  citation: string,
  summary: string,
  supports_claim_ids: string[],
  challenges_claim_ids: string[],
  reliability: number,
  recency: number,
  relevance: number,
  limitations: string,
  excerpt = ""
): EvidenceArtifact["evidence"][number] {
  return {
    id,
    source_type,
    citation,
    summary,
    ...(excerpt ? { excerpt } : {}),
    supports_claim_ids,
    challenges_claim_ids,
    reliability,
    recency,
    relevance,
    limitations
  };
}

function uncertainty(
  id: string,
  description: string,
  current_estimate: string,
  confidence: number,
  impact_if_wrong: string,
  evidence_needed: string
): UncertaintyArtifact["key_uncertainties"][number] {
  return { id, description, current_estimate, confidence, impact_if_wrong, evidence_needed };
}
