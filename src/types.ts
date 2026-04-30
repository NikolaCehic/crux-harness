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

export type RunConfig = {
  schema_version: "crux.run_config.v1";
  harness_version: string;
  run_id: string;
  created_at: string;
  input: {
    path: string;
    copied_path: string;
    content_hash: string;
  };
  source_policy: string;
  source_pack: string | null;
  budgets: {
    max_research_items: number | null;
    max_agent_steps: number | null;
    max_llm_calls: number | null;
  };
  artifact_contract: {
    schema_version: "crux.artifact_contract.v1";
    artifacts: Array<{
      name: string;
      version: string;
      schema_id?: string;
      required: boolean;
    }>;
  };
  mappers: {
    claim_decomposer: {
      type: "deterministic" | "llm";
      reason: string;
    };
    evidence_mapper: {
      type: "deterministic" | "llm";
      reason: string;
    };
  };
  stages: Array<{
    stage: string;
    module_id: string;
    module_version: string;
    kind: "deterministic" | "llm" | "external";
    prompt_version?: string;
    provider?: string;
    model?: string;
    timeout_ms: number;
    max_retries: number;
  }>;
  prompts: {
    claim_decomposer: string;
    evidence_mapper: string;
  };
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

export type SourceChunksArtifact = {
  source_pack: {
    path: string | null;
    mode: "none" | "directory";
  };
  chunks: SourceChunk[];
};

export type SourceChunk = {
  id: string;
  source_id: string;
  path: string;
  ordinal: number;
  text: string;
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
  chunk_ids?: string[];
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
    claim_graph_integrity: number;
    claim_coverage: number;
    evidence_traceability: number;
    source_quality: number;
    contradiction_handling: number;
    red_team_strength: number;
    uncertainty_quality: number;
    faithfulness: number;
    crux_quality: number;
    decision_usefulness: number;
  };
  findings: string[];
  failed_checks: string[];
  improvement_recommendations: string[];
  diagnostics: EvalDiagnostic[];
  council: EvalCouncilReport;
};

export type EvalDiagnostic = {
  id: string;
  stage: string;
  severity: "low" | "medium" | "high";
  category: string;
  message: string;
  recommended_fix: string;
};

export type EvalCouncilStatus = "pass" | "warn" | "fail";

export type EvalCouncilReview = {
  role_id:
    | "evidence_auditor"
    | "claim_graph_auditor"
    | "faithfulness_auditor"
    | "red_team_auditor"
    | "uncertainty_auditor"
    | "decision_utility_auditor"
    | "domain_reviewer"
    | "synthesis_judge";
  role_name: string;
  status: EvalCouncilStatus;
  score: number;
  stage: string;
  findings: string[];
  blocking_failures: string[];
  recommendations: string[];
};

export type EvalCouncilDisagreement = {
  topic: string;
  severity: "low" | "medium" | "high";
  positions: Array<{
    role_id: EvalCouncilReview["role_id"];
    position: string;
    status: EvalCouncilStatus;
  }>;
};

export type EvalCouncilReport = {
  schema_version: "crux.eval_council.v1";
  reviewers: EvalCouncilReview[];
  disagreements: EvalCouncilDisagreement[];
  synthesis: {
    status: EvalCouncilStatus;
    confidence: number;
    blocking_failures: string[];
    next_fixes: string[];
  };
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

export type ReviewArtifact = {
  schema_version: "crux.review.v1";
  run_id: string;
  created_at: string;
  updated_at: string;
  actions: ReviewAction[];
  summary: {
    approved_claims: string[];
    rejected_claims: string[];
    evidence_annotations: Array<{
      evidence_id: string;
      note_count: number;
    }>;
    stage_rerun_requests: string[];
  };
};

export type ReviewAction = {
  id: string;
  created_at: string;
  reviewer: string;
  action_type: "approve_claim" | "reject_claim" | "annotate_evidence" | "request_stage_rerun";
  target: {
    type: "claim" | "evidence" | "stage";
    id: string;
  };
  rationale: string;
  metadata: Record<string, unknown>;
};

export type PackManifest = {
  schema_version: "crux.pack.v1";
  name: string;
  display_name: string;
  version: string;
  analysis_scope: string;
  description: string;
  input_template: {
    output_goal: string;
    time_horizon: string;
    risk_tolerance: string;
    known_constraints?: string[];
  };
  source_requirements: {
    min_sources: number;
    required_source_types: SourceItem["source_type"][];
    required_questions: string[];
  };
  claim_taxonomy: string[];
  expected_evidence_types: string[];
  known_failure_modes: string[];
  eval_rubric: {
    min_scores: Record<string, number>;
    required_diagnostics: string[];
  };
  memo_sections: string[];
  benchmark: {
    scenario: string;
    expectation: string;
  };
};

export type RunContext = {
  projectRoot: string;
  runDir: string;
  runId: string;
  inputPath: string;
  input: RunInput;
};
