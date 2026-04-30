export type RunInput = {
  scenario_id?: string;
  analysis_scope?: string;
  source_pack?: string | {
    path: string;
  };
  question: string;
  decision_context: string;
  time_horizon: string;
  output_goal: string;
  geography?: string;
  risk_tolerance?: string;
  known_constraints?: string[];
  source_policy?: "offline" | "web" | "hybrid" | string;
  tool_budget?: {
    max_research_items?: number;
    max_agent_steps?: number;
  };
  model_budget?: {
    max_llm_calls?: number;
  };
  user_prior?: string;
};

export type QuestionSpec = {
  question: string;
  decision_type: string;
  decision_owner: string;
  context: string;
  time_horizon: string;
  success_criteria: string[];
  constraints: string[];
  unknowns: string[];
  required_artifacts: string[];
};

export type SourceInventory = {
  source_pack: {
    path: string | null;
    mode: "none" | "directory";
  };
  sources: SourceItem[];
};

export type SourceItem = {
  id: string;
  path: string;
  title: string;
  source_type: "web" | "paper" | "dataset" | "internal_document" | "expert_input";
  citation: string;
  url: string;
  published: string;
  summary: string;
  reliability: number;
  recency: number;
  relevance: number;
  tags: string[];
  content_hash: string;
};

export type Claim = {
  id: string;
  text: string;
  type: "descriptive" | "causal" | "predictive" | "comparative" | "normative" | "decision";
  status: "supported" | "weakly_supported" | "contested" | "unsupported" | "unknown";
  importance: number;
  confidence: number;
  depends_on: string[];
  evidence_ids: string[];
  counterevidence_ids: string[];
  notes: string;
};

export type ClaimsArtifact = {
  claims: Claim[];
  edges: Array<{
    from: string;
    to: string;
    relation: "supports" | "depends_on" | "challenges" | "causes" | "enables";
  }>;
  root_claim_ids: string[];
};

export type EvidenceItem = {
  id: string;
  source_type: "web" | "paper" | "dataset" | "internal_document" | "calculation" | "expert_input" | "model_output";
  citation: string;
  summary: string;
  source_ids?: string[];
  excerpt?: string;
  supports_claim_ids: string[];
  challenges_claim_ids: string[];
  reliability: number;
  recency: number;
  relevance: number;
  limitations: string;
};

export type EvidenceArtifact = {
  evidence: EvidenceItem[];
};

export type ContradictionsArtifact = {
  contradictions: Array<{
    id: string;
    claim_ids: string[];
    description: string;
    severity: "low" | "medium" | "high";
    resolution_status: "unresolved" | "partially_resolved" | "resolved";
    next_step: string;
  }>;
  unsupported_critical_claims: string[];
  missing_evidence: string[];
};

export type UncertaintyArtifact = {
  overall_confidence: number;
  key_uncertainties: Array<{
    id: string;
    description: string;
    current_estimate: string;
    confidence: number;
    impact_if_wrong: string;
    evidence_needed: string;
  }>;
  sensitivity: Array<{
    assumption: string;
    low_case: string;
    base_case: string;
    high_case: string;
    decision_impact: string;
  }>;
  what_would_change_my_mind: string[];
  recommended_tests: string[];
};

export type EvalReport = {
  scores: {
    schema_validity: number;
    claim_coverage: number;
    evidence_traceability: number;
    source_quality: number;
    contradiction_handling: number;
    red_team_strength: number;
    uncertainty_quality: number;
    decision_usefulness: number;
  };
  findings: string[];
  failed_checks: string[];
  improvement_recommendations: string[];
};

export type TraceEvent = {
  timestamp: string;
  stage: string;
  event_type: "start" | "complete" | "error" | "info";
  message: string;
  input_artifacts: string[];
  output_artifacts: string[];
  metadata: Record<string, unknown>;
};

export type RunContext = {
  projectRoot: string;
  runDir: string;
  runId: string;
  inputPath: string;
  input: RunInput;
};
