import type {
  AgentDefinition,
  AgentFinding,
  AgentFindingsArtifact,
  AgentManifest,
  ClaimsArtifact,
  ContradictionsArtifact,
  EvidenceArtifact,
  QuestionSpec,
  SourceChunksArtifact,
  SourceInventory,
  UncertaintyArtifact
} from "./types.js";

export type RunBoundedAgentsInput = {
  runId: string;
  manifest: AgentManifest;
  questionSpec: QuestionSpec;
  sourceInventory: SourceInventory;
  sourceChunks: SourceChunksArtifact;
  claims: ClaimsArtifact;
  evidence: EvidenceArtifact;
  contradictions: ContradictionsArtifact;
  redTeam: string;
  uncertainty: UncertaintyArtifact;
  decisionMemo: string;
};

export function buildAgentManifest(): AgentManifest {
  return {
    schema_version: "crux.agent_manifest.v1",
    mode: "bounded",
    agents: [
      agent({
        agent_id: "research_scout",
        name: "Research Scout",
        role: "Source gap planner",
        stage: "ingest_sources",
        purpose: "Identify whether the run has enough source material and name the next evidence to collect.",
        allowed_inputs: ["question_spec.json", "source_inventory.json", "source_chunks.json", "contradictions.json"],
        produced_outputs: ["source_gap_findings", "source_collection_actions"],
        max_steps: 4
      }),
      agent({
        agent_id: "evidence_auditor",
        name: "Evidence Auditor",
        role: "Claim support auditor",
        stage: "gather_evidence",
        purpose: "Check that important claims are connected to evidence and that cited evidence is source-backed when possible.",
        allowed_inputs: ["claims.json", "evidence.json", "source_inventory.json", "source_chunks.json"],
        produced_outputs: ["evidence_traceability_findings", "claim_support_actions"],
        max_steps: 5
      }),
      agent({
        agent_id: "red_team_agent",
        name: "Red Team Agent",
        role: "Recommendation breaker",
        stage: "red_team",
        purpose: "Pressure-test the recommendation and ensure failure modes affect the decision.",
        allowed_inputs: ["claims.json", "evidence.json", "contradictions.json", "red_team.md", "decision_memo.md"],
        produced_outputs: ["counterargument_findings", "failure_mode_actions"],
        max_steps: 5
      }),
      agent({
        agent_id: "council_moderator",
        name: "Council Moderator",
        role: "Cross-agent synthesis judge",
        stage: "run_agents",
        purpose: "Find disagreements between specialist checks and summarize whether the run is ready for human use.",
        allowed_inputs: ["agent_findings.json"],
        produced_outputs: ["agent_synthesis", "blocking_issue_summary"],
        max_steps: 3
      }),
      agent({
        agent_id: "replay_planner",
        name: "Replay Planner",
        role: "Run improvement planner",
        stage: "replay",
        purpose: "Turn uncertainty and missing evidence into concrete next-run improvements.",
        allowed_inputs: ["contradictions.json", "uncertainty.json", "decision_memo.md"],
        produced_outputs: ["replay_plan", "input_improvement_actions"],
        max_steps: 4
      }),
      agent({
        agent_id: "eval_scenario_agent",
        name: "Eval Scenario Agent",
        role: "E2E test designer",
        stage: "evaluate",
        purpose: "Suggest regression and adversarial scenarios that would test this run class.",
        allowed_inputs: ["run_config.json", "question_spec.json", "claims.json", "contradictions.json", "uncertainty.json"],
        produced_outputs: ["eval_scenario_suggestions", "adversarial_test_actions"],
        max_steps: 4
      })
    ]
  };
}

export function runBoundedAgents(input: RunBoundedAgentsInput): AgentFindingsArtifact {
  const findings = [
    reviewResearchScout(input),
    reviewEvidence(input),
    reviewRedTeam(input),
    reviewReplayPlan(input),
    reviewEvalScenarios(input)
  ];
  const synthesis = synthesizeAgentFindings(input.manifest.agents, findings);
  const moderator = buildCouncilModeratorFinding(input.manifest.agents, findings, synthesis);
  const allFindings = insertModeratorFinding(findings, moderator);
  const finalSynthesis = synthesizeAgentFindings(input.manifest.agents, allFindings);

  return {
    schema_version: "crux.agent_findings.v1",
    run_id: input.runId,
    created_at: new Date().toISOString(),
    mode: "bounded",
    findings: allFindings,
    synthesis: finalSynthesis
  };
}

function agent(input: Omit<AgentDefinition, "autonomy" | "limits"> & { max_steps: number }): AgentDefinition {
  return {
    agent_id: input.agent_id,
    name: input.name,
    role: input.role,
    stage: input.stage,
    autonomy: "bounded",
    purpose: input.purpose,
    allowed_inputs: input.allowed_inputs,
    produced_outputs: input.produced_outputs,
    limits: {
      no_external_side_effects: true,
      max_steps: input.max_steps,
      requires_trace: true
    }
  };
}

function reviewResearchScout(input: RunBoundedAgentsInput): AgentFinding {
  const definition = getDefinition(input.manifest, "research_scout");
  const sourceCount = input.sourceInventory.sources.length;
  const chunkCount = input.sourceChunks.chunks.length;
  const missingEvidence = input.contradictions.missing_evidence;
  const status = sourceCount === 0 || missingEvidence.length >= 4 ? "warn" : "pass";

  return finding(definition, {
    status,
    confidence: sourceCount > 0 ? 0.78 : 0.58,
    summary: sourceCount > 0
      ? `Run has ${sourceCount} sources and ${chunkCount} chunks; scout focus is filling remaining evidence gaps.`
      : "Run has no ingested sources; scout recommends source collection before production use.",
    findings: [
      `Source inventory contains ${sourceCount} sources.`,
      `Source chunks contain ${chunkCount} chunks.`,
      `${missingEvidence.length} missing-evidence needs are listed in contradictions.json.`
    ],
    blocking_issues: sourceCount === 0 ? ["No source material is attached to the run."] : [],
    recommendations: missingEvidence.length > 0
      ? missingEvidence.slice(0, 4).map((item) => `Collect evidence for: ${item}`)
      : ["Keep source pack coverage linked to the decision crux."],
    next_actions: missingEvidence.slice(0, 3),
    input_artifacts: definition.allowed_inputs
  });
}

function reviewEvidence(input: RunBoundedAgentsInput): AgentFinding {
  const definition = getDefinition(input.manifest, "evidence_auditor");
  const importantClaims = input.claims.claims.filter((claim) => claim.importance >= 0.75);
  const unsupportedImportant = importantClaims.filter((claim) => claim.evidence_ids.length === 0 && claim.counterevidence_ids.length === 0 && !["unsupported", "unknown"].includes(claim.status));
  const sourceBackedEvidence = input.evidence.evidence.filter((item) => (item.source_ids ?? []).length > 0);
  const traceableClaims = input.claims.claims.filter((claim) => claim.evidence_ids.length > 0 || claim.counterevidence_ids.length > 0 || ["unsupported", "unknown"].includes(claim.status));
  const traceability = input.claims.claims.length > 0 ? traceableClaims.length / input.claims.claims.length : 0;
  const sourceBackedRatio = input.evidence.evidence.length > 0 ? sourceBackedEvidence.length / input.evidence.evidence.length : 0;
  const status = unsupportedImportant.length > 0 ? "fail" : sourceBackedRatio < 0.5 ? "warn" : "pass";

  return finding(definition, {
    status,
    confidence: round((traceability * 0.6) + (sourceBackedRatio * 0.4)),
    summary: `${traceableClaims.length}/${input.claims.claims.length} claims are evidence-traceable; ${sourceBackedEvidence.length}/${input.evidence.evidence.length} evidence items cite sources.`,
    findings: [
      `Important claims reviewed: ${importantClaims.length}.`,
      `Unsupported important claims: ${unsupportedImportant.map((claim) => claim.id).join(", ") || "none"}.`,
      `Source-backed evidence items: ${sourceBackedEvidence.length}.`
    ],
    blocking_issues: unsupportedImportant.map((claim) => `Claim ${claim.id} is important but has no evidence IDs.`),
    recommendations: unsupportedImportant.length > 0
      ? unsupportedImportant.map((claim) => `Map evidence to important claim ${claim.id} or downgrade its status.`)
      : ["Keep every supported claim linked to source-backed evidence where possible."],
    next_actions: unsupportedImportant.slice(0, 3).map((claim) => `Repair evidence mapping for ${claim.id}.`),
    input_artifacts: definition.allowed_inputs
  });
}

function reviewRedTeam(input: RunBoundedAgentsInput): AgentFinding {
  const definition = getDefinition(input.manifest, "red_team_agent");
  const requiredSections = ["## Opposing Thesis", "## Strongest Counterarguments", "## Failure Modes", "## Missing Evidence", "## Recommendation Impact"];
  const present = requiredSections.filter((section) => input.redTeam.includes(section));
  const hasMemoImpact = input.decisionMemo.includes("## Red-Team Findings") && input.decisionMemo.includes("staged");
  const status = present.length < requiredSections.length || !hasMemoImpact ? "warn" : "pass";

  return finding(definition, {
    status,
    confidence: round((present.length / requiredSections.length) * 0.8 + (hasMemoImpact ? 0.2 : 0)),
    summary: `Red-team artifact includes ${present.length}/${requiredSections.length} required sections and ${hasMemoImpact ? "does" : "does not"} affect the memo.`,
    findings: [
      `Missing red-team sections: ${requiredSections.filter((section) => !present.includes(section)).join(", ") || "none"}.`,
      hasMemoImpact ? "Decision memo includes red-team impact." : "Decision memo does not clearly include red-team impact."
    ],
    blocking_issues: [],
    recommendations: status === "pass"
      ? ["Keep red-team findings tied to recommendation impact."]
      : ["Strengthen red-team output and propagate its impact into the decision memo."],
    next_actions: status === "pass" ? [] : ["Rewrite red-team impact before treating this run as reviewed."],
    input_artifacts: definition.allowed_inputs
  });
}

function reviewReplayPlan(input: RunBoundedAgentsInput): AgentFinding {
  const definition = getDefinition(input.manifest, "replay_planner");
  const tests = input.uncertainty.recommended_tests;
  const missingEvidence = input.contradictions.missing_evidence;
  const nextActions = [...tests.slice(0, 3), ...missingEvidence.slice(0, 2)];
  const status = nextActions.length >= 3 ? "pass" : "warn";

  return finding(definition, {
    status,
    confidence: tests.length >= 4 ? 0.82 : 0.64,
    summary: `Replay planner found ${tests.length} recommended tests and ${missingEvidence.length} missing-evidence items.`,
    findings: [
      `Recommended tests: ${tests.length}.`,
      `Missing-evidence items: ${missingEvidence.length}.`,
      `Decision memo ${input.decisionMemo.includes("## Next Tests") ? "includes" : "does not include"} next tests.`
    ],
    blocking_issues: [],
    recommendations: [
      "Create the next run only after adding at least one evidence item for the top missing-evidence need.",
      "Compare the replay against this run before accepting trust movement."
    ],
    next_actions: nextActions,
    input_artifacts: definition.allowed_inputs
  });
}

function reviewEvalScenarios(input: RunBoundedAgentsInput): AgentFinding {
  const definition = getDefinition(input.manifest, "eval_scenario_agent");
  const scope = input.questionSpec.constraints.find((constraint) => constraint.startsWith("Analysis scope:"))?.replace("Analysis scope:", "").trim() || "general-analysis";
  const highContradictions = input.contradictions.contradictions.filter((item) => item.severity === "high").length;
  const scenarioActions = [
    `Golden scenario: repeat this ${scope} decision with source-backed evidence.`,
    `Adversarial scenario: remove evidence for ${input.claims.root_claim_ids[0] ?? "the root claim"} and require diagnostics.`,
    `Regression scenario: replay after adding source material and compare trust movement.`
  ];
  const status = highContradictions > 0 ? "pass" : "warn";

  return finding(definition, {
    status,
    confidence: highContradictions > 0 ? 0.8 : 0.62,
    summary: `Eval scenario agent generated ${scenarioActions.length} scenario ideas for scope ${scope}.`,
    findings: [
      `High-severity contradictions: ${highContradictions}.`,
      `Root claims available for adversarial mutation: ${input.claims.root_claim_ids.join(", ") || "none"}.`
    ],
    blocking_issues: [],
    recommendations: scenarioActions,
    next_actions: scenarioActions,
    input_artifacts: definition.allowed_inputs
  });
}

function buildCouncilModeratorFinding(
  definitions: AgentDefinition[],
  findings: AgentFinding[],
  synthesis: AgentFindingsArtifact["synthesis"]
): AgentFinding {
  const definition = definitions.find((agentDefinition) => agentDefinition.agent_id === "council_moderator");
  if (!definition) {
    throw new Error("Missing bounded agent definition: council_moderator");
  }
  const failed = findings.filter((item) => item.status === "fail");
  const warned = findings.filter((item) => item.status === "warn");

  return finding(definition, {
    status: synthesis.status,
    confidence: synthesis.confidence,
    summary: `Moderator found ${failed.length} failing agents and ${warned.length} warning agents.`,
    findings: [
      `Failing agents: ${failed.map((item) => item.name).join(", ") || "none"}.`,
      `Warning agents: ${warned.map((item) => item.name).join(", ") || "none"}.`,
      `Synthesis status before moderation: ${synthesis.status}.`
    ],
    blocking_issues: synthesis.blocking_issues,
    recommendations: synthesis.next_actions.length > 0
      ? synthesis.next_actions
      : ["No agent-level blockers were found; continue with human review and eval council inspection."],
    next_actions: synthesis.next_actions,
    input_artifacts: definition.allowed_inputs
  });
}

function synthesizeAgentFindings(
  definitions: AgentDefinition[],
  findings: AgentFinding[]
): AgentFindingsArtifact["synthesis"] {
  const blockingIssues = findings.flatMap((findingItem) => {
    return findingItem.blocking_issues.map((issue) => `${findingItem.name}: ${issue}`);
  });
  const status = blockingIssues.length > 0
    ? "fail"
    : findings.some((findingItem) => findingItem.status === "warn")
      ? "warn"
      : "pass";
  const expectedCount = definitions.length;
  const coverage = expectedCount > 0 ? findings.length / expectedCount : 0;
  const meanConfidence = findings.length > 0
    ? findings.reduce((sum, findingItem) => sum + findingItem.confidence, 0) / findings.length
    : 0;

  return {
    status,
    confidence: round(meanConfidence * 0.8 + Math.min(coverage, 1) * 0.2),
    blocking_issues: blockingIssues,
    next_actions: [...new Set(findings.flatMap((findingItem) => findingItem.next_actions).filter(Boolean))].slice(0, 8)
  };
}

function insertModeratorFinding(findings: AgentFinding[], moderator: AgentFinding): AgentFinding[] {
  const beforeModerator = findings.slice(0, 3);
  const afterModerator = findings.slice(3);
  return [...beforeModerator, moderator, ...afterModerator];
}

function finding(
  definition: AgentDefinition,
  input: Omit<AgentFinding, "agent_id" | "name" | "role" | "stage">
): AgentFinding {
  return {
    agent_id: definition.agent_id,
    name: definition.name,
    role: definition.role,
    stage: definition.stage,
    ...input,
    confidence: clamp(input.confidence)
  };
}

function getDefinition(manifest: AgentManifest, agentId: AgentDefinition["agent_id"]): AgentDefinition {
  const definition = manifest.agents.find((candidate) => candidate.agent_id === agentId);
  if (!definition) {
    throw new Error(`Missing bounded agent definition: ${agentId}`);
  }

  return definition;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
