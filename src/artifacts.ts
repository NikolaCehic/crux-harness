import type {
  Claim,
  ClaimsArtifact,
  ContradictionsArtifact,
  EvalReport,
  EvidenceArtifact,
  QuestionSpec,
  RunInput,
  UncertaintyArtifact
} from "./types.js";

export function buildQuestionSpec(input: RunInput): QuestionSpec {
  return {
    question: input.question,
    decision_type: "strategic technology decision",
    decision_owner: "technical founder or strategy lead",
    context: input.decision_context,
    time_horizon: input.time_horizon,
    success_criteria: [
      "Decision can be acted on within the stated time horizon.",
      "Critical assumptions are explicit and testable.",
      "Recommendation includes conditions that would change the decision.",
      "Evidence quality is separated from persuasive prose."
    ],
    constraints: [
      ...(input.known_constraints ?? []),
      `Risk tolerance: ${input.risk_tolerance ?? "unspecified"}`,
      `Geography: ${input.geography ?? "unspecified"}`
    ],
    unknowns: [
      "Whether target buyers have urgent budget-backed demand.",
      "Whether differentiation is durable against incumbents.",
      "Whether distribution constraints dominate product quality.",
      "Whether the market changes materially during the time horizon."
    ],
    required_artifacts: [
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

export function buildClaims(): ClaimsArtifact {
  const claims = [
    claim("C1", "The company should proceed only if the enterprise agent platform wedge can produce validated customer traction within 12 months.", "decision", "contested", 1, 0.58, ["C2", "C3", "C4", "C5"], ["E1", "E2", "E7"], ["E5"], "Root decision claim; depends on demand, differentiation, distribution, and execution feasibility."),
    claim("C2", "Enterprise buyers have meaningful interest in agent platforms that can automate multi-step operational work.", "descriptive", "weakly_supported", 0.9, 0.68, [], ["E1", "E2"], [], "Demand appears real, but urgency varies by workflow and buyer trust."),
    claim("C3", "A seed-stage technical team can differentiate through reliability, evaluation, integrations, and domain-specific workflows.", "causal", "weakly_supported", 0.86, 0.61, [], ["E3", "E7"], ["E5"], "Technical depth can matter, but distribution and trust may dominate."),
    claim("C4", "The enterprise agent platform category is crowded and likely to attract incumbent bundling pressure.", "descriptive", "supported", 0.88, 0.76, [], ["E4", "E5"], [], "Crowding is a major strategic risk."),
    claim("C5", "Enterprise sales cycles may be too slow for a small team that needs credible traction within 12 months.", "predictive", "contested", 0.84, 0.56, [], ["E5"], ["E2"], "This is one of the most important uncertainties."),
    claim("C6", "The product should start with a narrow workflow wedge instead of a broad horizontal platform.", "normative", "supported", 0.82, 0.72, ["C3", "C4", "C5"], ["E3", "E6", "E7"], [], "A narrow wedge reduces scope, improves validation speed, and makes differentiation clearer."),
    claim("C7", "Evaluation, observability, and failure recovery are likely to be core adoption blockers for enterprise agents.", "causal", "weakly_supported", 0.8, 0.66, [], ["E3", "E7"], [], "This is a plausible technical wedge for a deep engineering team."),
    claim("C8", "Generic agent orchestration alone is unlikely to be a durable moat.", "comparative", "supported", 0.78, 0.73, ["C4"], ["E4", "E5"], [], "Horizontal orchestration will likely be commoditized or bundled."),
    claim("C9", "Design partners are the fastest way to test whether the strategy is viable.", "causal", "supported", 0.76, 0.75, ["C2", "C5"], ["E6", "E8"], [], "Direct buyer validation resolves several critical unknowns cheaply."),
    claim("C10", "The team should defer full platform buildout until it validates one repeatable workflow with measurable ROI.", "decision", "supported", 0.86, 0.7, ["C6", "C9"], ["E6", "E8"], [], "This converts the platform idea into a staged decision."),
    claim("C11", "If incumbents bundle sufficient agent capabilities into existing enterprise suites, standalone platform adoption becomes harder.", "predictive", "weakly_supported", 0.74, 0.62, ["C4"], ["E4", "E5"], [], "Bundling pressure is probable but not uniformly decisive."),
    claim("C12", "The opportunity is attractive only if the startup can own a painful workflow where reliability matters more than brand trust.", "decision", "contested", 0.9, 0.6, ["C2", "C3", "C4", "C5", "C7"], ["E3", "E7", "E8"], ["E5"], "This is the practical crux of the decision.")
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

export function buildEvidence(): EvidenceArtifact {
  return {
    evidence: [
      evidence("E1", "model_output", "Curated market hypothesis for Crux v0.1 offline stub", "Enterprise interest in AI agents is plausible because organizations want automation for multi-step knowledge work.", ["C2"], [], 0.45, 0.55, 0.72, "Offline stub evidence; must be replaced by live sources before real decisions."),
      evidence("E2", "expert_input", "Assumed founder/customer discovery notes placeholder", "Early buyers may be willing to test agent systems when there is a clear workflow owner and measurable operational pain.", ["C2", "C5"], [], 0.5, 0.5, 0.68, "Placeholder for actual design-partner interviews."),
      evidence("E3", "model_output", "Technical wedge analysis placeholder", "Reliability, evals, observability, integrations, and recovery loops are plausible areas where a technical team can outperform generic wrappers.", ["C3", "C6", "C7", "C12"], [], 0.48, 0.6, 0.78, "Needs validation against customer requirements and incumbent products."),
      evidence("E4", "model_output", "Competitive dynamics placeholder", "Horizontal platform features tend to be copied, bundled, or abstracted by larger infrastructure vendors.", ["C4", "C8", "C11"], [], 0.52, 0.58, 0.76, "General strategic prior rather than sourced market proof."),
      evidence("E5", "model_output", "Enterprise distribution risk placeholder", "Enterprise adoption often depends on trust, procurement, security review, existing vendor relationships, and sales capacity.", ["C4", "C5"], ["C1", "C3", "C12"], 0.55, 0.56, 0.82, "Requires domain-specific sales cycle evidence."),
      evidence("E6", "calculation", "12-month runway validation logic", "A narrow workflow wedge reduces validation surface area and lets the team test ROI, buyer urgency, and implementation complexity faster than a full platform.", ["C6", "C9", "C10"], [], 0.6, 0.7, 0.8, "Reasoned calculation, not empirical proof."),
      evidence("E7", "model_output", "Agent reliability adoption hypothesis", "Enterprise buyers are likely to care about auditability, permissioning, failure handling, and measurable reliability before scaling agent deployments.", ["C3", "C7", "C12"], [], 0.5, 0.62, 0.78, "Needs source-backed validation."),
      evidence("E8", "expert_input", "Design partner test plan placeholder", "Three to five serious design partners can reveal whether the wedge has budget, urgency, and repeatable implementation patterns.", ["C9", "C10", "C12"], [], 0.58, 0.66, 0.74, "Assumes access to qualified buyers.")
    ]
  };
}

export function buildContradictions(): ContradictionsArtifact {
  return {
    contradictions: [
      {
        id: "K1",
        claim_ids: ["C2", "C5"],
        description: "Enterprise interest can be real while sales cycles remain too slow for a seed-stage 12-month traction goal.",
        severity: "high",
        resolution_status: "unresolved",
        next_step: "Interview qualified buyers and measure whether pilots can start inside 30 to 45 days."
      },
      {
        id: "K2",
        claim_ids: ["C3", "C4", "C8"],
        description: "Technical differentiation may matter, but horizontal platform capabilities are vulnerable to incumbent bundling.",
        severity: "high",
        resolution_status: "partially_resolved",
        next_step: "Define one workflow where reliability and domain depth matter more than generic orchestration."
      },
      {
        id: "K3",
        claim_ids: ["C1", "C12"],
        description: "The broad platform recommendation remains weaker than the narrower workflow-wedge recommendation.",
        severity: "medium",
        resolution_status: "partially_resolved",
        next_step: "Stage the decision: validate a wedge before committing to platform buildout."
      }
    ],
    unsupported_critical_claims: ["C2", "C3", "C5", "C12"],
    missing_evidence: [
      "Current buyer interviews with budget owners.",
      "Competitive feature map against incumbent AI platforms.",
      "Pilot conversion data for agent products in similar enterprise workflows.",
      "Security and procurement requirements for the target buyer segment."
    ]
  };
}

export function buildRedTeam(): string {
  return `## Opposing Thesis

The startup should not build a broad enterprise agent platform in 2026. The category is crowded, incumbent vendors can bundle horizontal capabilities, and a seed-stage team may not have enough distribution power to win enterprise trust before runway pressure forces a pivot.

## Strongest Counterarguments

1. Enterprise demand does not automatically translate into urgent budget for a new vendor.
2. A horizontal platform asks customers to trust a small startup with broad operational surface area.
3. Incumbents can copy orchestration, integrations, and workflow-builder features faster than a startup can build distribution.
4. The most painful adoption blockers may be organizational, procurement, and change-management issues rather than technical gaps.
5. A technical team may overbuild infrastructure before proving that one workflow has repeatable ROI.

## Failure Modes

- The team spends six months building platform primitives without a committed workflow owner.
- Pilots happen, but they remain innovation-budget experiments rather than production deployments.
- The product is evaluated against incumbent suites rather than against the customer's current manual process.
- Security review and integration requirements consume the team's runway.

## Missing Evidence

- Direct interviews with budget-owning buyers.
- Proof that pilots can start quickly enough for the runway.
- Evidence that one workflow has repeatable implementation patterns.
- A competitive map showing where incumbents are genuinely weak.

## Recommendation Impact

The red-team case weakens any recommendation to build a broad platform immediately. It supports a staged strategy: validate one narrow workflow wedge with design partners, then expand into platform capabilities only after repeatable demand is proven.
`;
}

export function buildUncertainty(): UncertaintyArtifact {
  return {
    overall_confidence: 0.62,
    key_uncertainties: [
      uncertainty("U1", "Buyer urgency", "Meaningful interest, uncertain near-term budget", 0.55, "If urgency is low, the 12-month traction goal likely fails.", "Budget-owner interviews and signed pilot commitments."),
      uncertainty("U2", "Sales-cycle length", "Potentially too slow for a seed-stage team", 0.5, "Long cycles would favor a narrower or non-enterprise wedge.", "Measured time from intro to pilot start across design partners."),
      uncertainty("U3", "Durable differentiation", "Possible through reliability and domain depth", 0.58, "If differentiation is shallow, incumbents or wrappers compress the opportunity.", "Competitive teardown and prototype comparison."),
      uncertainty("U4", "Workflow repeatability", "Unknown until design partners converge on similar pain", 0.52, "Non-repeatable workflows turn the company into bespoke services.", "Three to five pilots in one tightly defined workflow."),
      uncertainty("U5", "Incumbent bundling pressure", "Likely, but impact varies by workflow", 0.6, "If incumbents cover the workflow well enough, standalone adoption becomes difficult.", "Feature and procurement comparison with incumbent suites.")
    ],
    sensitivity: [
      {
        assumption: "Qualified design partners can start pilots within 45 days.",
        low_case: "Only exploratory calls; no committed pilots.",
        base_case: "Three pilots start within 45 days.",
        high_case: "Five budget-backed pilots start within 30 days.",
        decision_impact: "This assumption controls whether the company should proceed now or defer."
      },
      {
        assumption: "Reliability/evals are a painful enough wedge.",
        low_case: "Buyers view reliability as table stakes bundled by incumbents.",
        base_case: "Reliability matters for a subset of workflows.",
        high_case: "Reliability is the main blocker to production deployment.",
        decision_impact: "High case supports a technical wedge; low case pushes away from platform strategy."
      }
    ],
    what_would_change_my_mind: [
      "Five budget-owning buyers commit to pilots for the same narrow workflow.",
      "A competitive teardown shows incumbents cannot satisfy the workflow's reliability or integration needs.",
      "Pilot users demonstrate measurable ROI within two weeks of deployment.",
      "Security and procurement requirements are lightweight enough for a seed-stage vendor.",
      "Customer discovery shows buyers want a broad platform before a narrow workflow solution."
    ],
    recommended_tests: [
      "Run 20 buyer interviews focused on one workflow and explicit budget.",
      "Build a thin prototype for one workflow and test it with three design partners.",
      "Create a competitor matrix for the exact workflow, not the broad platform category.",
      "Measure time from first call to pilot start.",
      "Define the minimum reliability/eval capability required for production use."
    ]
  };
}

export function buildDecisionMemo(input: RunInput): string {
  return `## Recommendation

Do not commit immediately to a broad enterprise agent platform. Proceed with a staged strategy: validate one narrow, painful enterprise workflow where agent reliability, evaluation, and recovery matter enough to overcome startup trust and distribution disadvantages.

## Executive Summary

The opportunity is real but dangerous. Enterprise agent demand is plausible, and a strong technical team may find a wedge in reliability, observability, and workflow-specific automation. The broad platform framing is the risky part. It invites direct comparison with incumbents, stretches the team across many integrations, and may require enterprise sales capacity before the product has proof.

For the next 30 to 45 days, the correct move is not full platform buildout. The correct move is to test whether one repeatable workflow has budget-backed urgency.

## Core Reasoning

The decision depends on whether enterprise demand, technical differentiation, and distribution feasibility line up inside the ${input.time_horizon} horizon. The current evidence supports a conditional proceed: build only the smallest workflow-specific wedge that can validate buyer urgency and measurable ROI.

## Key Claims

- Enterprise buyers are interested in agent systems, but urgency must be proven.
- Horizontal agent platforms are crowded and exposed to incumbent bundling.
- A narrow workflow wedge improves speed of validation and differentiation.
- Reliability, evaluation, and failure recovery may be the strongest technical wedge.
- Sales-cycle length is a critical threat to the 12-month traction goal.

## Evidence Quality

Evidence quality is currently moderate to weak because this v0.1 run uses offline placeholder evidence. The structure is decision-useful, but a real recommendation requires live source collection, buyer interviews, and competitive research.

## Red-Team Findings

The strongest objection is that the team could spend months building generic platform primitives while buyers treat the product as an experiment rather than a production system. Incumbents may bundle enough horizontal functionality to make broad platform differentiation weak.

## Uncertainty

Overall confidence: 0.62.

The most important uncertainty is buyer urgency. If qualified buyers will not start pilots quickly, the strategy should change. The second major uncertainty is whether reliability/evals are a strong enough wedge to beat incumbent trust advantages.

## What Would Change This Decision

- Strong evidence of five budget-backed design partners would strengthen the case to proceed.
- Slow sales cycles or non-repeatable workflow needs would weaken the case.
- Incumbent coverage of the target workflow would weaken the case.
- Measurable ROI from a thin prototype would strengthen the case.

## Next Tests

1. Interview 20 budget-owning buyers.
2. Select one workflow with urgent pain and repeatable implementation needs.
3. Run three design-partner pilots.
4. Compare the workflow against incumbent products.
5. Decide after 30 to 45 days whether to expand, narrow further, or abandon.
`;
}

export function buildInitialEvalReport(): EvalReport {
  return {
    scores: {
      schema_validity: 1,
      claim_coverage: 0.82,
      evidence_traceability: 0.76,
      source_quality: 0.42,
      contradiction_handling: 0.8,
      red_team_strength: 0.78,
      uncertainty_quality: 0.84,
      decision_usefulness: 0.86
    },
    findings: [
      "The run produced the required artifact shape and a complete deterministic reasoning path.",
      "Source quality is intentionally limited because v0.1 uses offline placeholder evidence.",
      "The recommendation is conditional and exposes what would change the decision."
    ],
    failed_checks: [],
    improvement_recommendations: [
      "Replace placeholder evidence with live web research and uploaded source documents.",
      "Add evaluator checks that compare memo claims against claim IDs.",
      "Add golden benchmark tasks before tuning agent prompts."
    ]
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
  limitations: string
): EvidenceArtifact["evidence"][number] {
  return { id, source_type, citation, summary, supports_claim_ids, challenges_claim_ids, reliability, recency, relevance, limitations };
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
