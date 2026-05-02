import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildAgentManifest } from "./agents.js";
import type {
  AgentFindingsArtifact,
  AgentManifest,
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

export type RunArtifactBundle = {
  run_dir: string;
  absolute_run_dir: string;
  run_config: RunConfig;
  question_spec: QuestionSpec;
  source_inventory: SourceInventory;
  source_chunks: SourceChunksArtifact;
  claims: ClaimsArtifact;
  evidence: EvidenceArtifact;
  contradictions: ContradictionsArtifact;
  uncertainty: UncertaintyArtifact;
  agent_manifest: AgentManifest;
  agent_findings: AgentFindingsArtifact;
  red_team: string;
  decision_memo: string;
  eval_report: EvalReport;
  trace: TraceEvent[];
  summary: {
    scenario: string;
    claim_count: number;
    evidence_count: number;
    source_count: number;
    source_chunk_count: number;
    contradiction_count: number;
    diagnostic_count: number;
    agent_count: number;
    agent_status: AgentFindingsArtifact["synthesis"]["status"];
    council_status: EvalReport["council"]["synthesis"]["status"];
  };
  relationships: {
    evidence_ids_by_claim_id: Record<string, string[]>;
    source_ids_by_evidence_id: Record<string, string[]>;
    chunk_ids_by_evidence_id: Record<string, string[]>;
  };
};

export async function loadRunArtifactBundle(projectRoot: string, runDir: string): Promise<RunArtifactBundle> {
  const absoluteRunDir = path.resolve(projectRoot, runDir);
  const [
    runConfig,
    questionSpec,
    sourceInventory,
    sourceChunks,
    claims,
    evidence,
    contradictions,
    uncertainty,
    agentManifest,
    agentFindings,
    redTeam,
    decisionMemo,
    evalReport,
    trace
  ] = await Promise.all([
    readJson<RunConfig>(absoluteRunDir, "run_config.json"),
    readJson<QuestionSpec>(absoluteRunDir, "question_spec.json"),
    readJson<SourceInventory>(absoluteRunDir, "source_inventory.json"),
    readJson<SourceChunksArtifact>(absoluteRunDir, "source_chunks.json"),
    readJson<ClaimsArtifact>(absoluteRunDir, "claims.json"),
    readJson<EvidenceArtifact>(absoluteRunDir, "evidence.json"),
    readJson<ContradictionsArtifact>(absoluteRunDir, "contradictions.json"),
    readJson<UncertaintyArtifact>(absoluteRunDir, "uncertainty.json"),
    readOptionalJson<AgentManifest>(absoluteRunDir, "agent_manifest.json"),
    readOptionalJson<AgentFindingsArtifact>(absoluteRunDir, "agent_findings.json"),
    readText(absoluteRunDir, "red_team.md"),
    readText(absoluteRunDir, "decision_memo.md"),
    readJson<EvalReport>(absoluteRunDir, "eval_report.json"),
    readTrace(absoluteRunDir)
  ]);

  const normalizedAgentManifest = agentManifest ?? buildAgentManifest();
  const normalizedAgentFindings = agentFindings ?? buildLegacyAgentFindings(runConfig);

  return {
    run_dir: path.relative(projectRoot, absoluteRunDir),
    absolute_run_dir: absoluteRunDir,
    run_config: runConfig,
    question_spec: questionSpec,
    source_inventory: sourceInventory,
    source_chunks: sourceChunks,
    claims,
    evidence,
    contradictions,
    uncertainty,
    agent_manifest: normalizedAgentManifest,
    agent_findings: normalizedAgentFindings,
    red_team: redTeam,
    decision_memo: decisionMemo,
    eval_report: evalReport,
    trace,
    summary: {
      scenario: path.basename(runConfig.input.path).replace(/\.(yaml|yml)$/i, ""),
      claim_count: claims.claims.length,
      evidence_count: evidence.evidence.length,
      source_count: sourceInventory.sources.length,
      source_chunk_count: sourceChunks.chunks.length,
      contradiction_count: contradictions.contradictions.length,
      diagnostic_count: evalReport.diagnostics.length,
      agent_count: agentFindings ? normalizedAgentFindings.findings.length : 0,
      agent_status: normalizedAgentFindings.synthesis.status,
      council_status: evalReport.council.synthesis.status
    },
    relationships: buildRelationships(claims, evidence)
  };
}

function buildRelationships(claims: ClaimsArtifact, evidence: EvidenceArtifact): RunArtifactBundle["relationships"] {
  const evidenceIdsByClaimId: Record<string, string[]> = {};
  const sourceIdsByEvidenceId: Record<string, string[]> = {};
  const chunkIdsByEvidenceId: Record<string, string[]> = {};

  for (const claim of claims.claims) {
    evidenceIdsByClaimId[claim.id] = [...new Set([...claim.evidence_ids, ...claim.counterevidence_ids])];
  }

  for (const item of evidence.evidence) {
    sourceIdsByEvidenceId[item.id] = item.source_ids ?? [];
    chunkIdsByEvidenceId[item.id] = item.chunk_ids ?? [];
    for (const claimId of [...item.supports_claim_ids, ...item.challenges_claim_ids]) {
      evidenceIdsByClaimId[claimId] = [...new Set([...(evidenceIdsByClaimId[claimId] ?? []), item.id])];
    }
  }

  return {
    evidence_ids_by_claim_id: evidenceIdsByClaimId,
    source_ids_by_evidence_id: sourceIdsByEvidenceId,
    chunk_ids_by_evidence_id: chunkIdsByEvidenceId
  };
}

async function readJson<T>(runDir: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(runDir, file), "utf8")) as T;
}

async function readOptionalJson<T>(runDir: string, file: string): Promise<T | undefined> {
  try {
    return await readJson<T>(runDir, file);
  } catch {
    return undefined;
  }
}

async function readText(runDir: string, file: string): Promise<string> {
  return readFile(path.join(runDir, file), "utf8");
}

async function readTrace(runDir: string): Promise<TraceEvent[]> {
  const raw = await readFile(path.join(runDir, "trace.jsonl"), "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as TraceEvent);
}

function buildLegacyAgentFindings(runConfig: RunConfig): AgentFindingsArtifact {
  const moderator = buildAgentManifest().agents.find((agent) => agent.agent_id === "council_moderator");
  if (!moderator) {
    throw new Error("Agent manifest is missing council_moderator");
  }

  const blockingIssue = "This run predates bounded agent artifacts; regenerate it with harness version 1.12.0 or later for agent inspection.";

  return {
    schema_version: "crux.agent_findings.v1",
    run_id: runConfig.run_id,
    created_at: runConfig.created_at,
    mode: "bounded",
    findings: [
      {
        agent_id: moderator.agent_id,
        name: moderator.name,
        role: moderator.role,
        status: "warn",
        confidence: 0.2,
        stage: moderator.stage,
        summary: "No bounded specialist checks were preserved for this legacy run.",
        findings: ["agent_findings.json was not available in the run directory."],
        blocking_issues: [blockingIssue],
        recommendations: ["Re-run the scenario with the current harness to produce agent_manifest.json and agent_findings.json."],
        next_actions: ["Regenerate this run before using the bounded agent section for operational review."],
        input_artifacts: ["agent_findings.json"]
      }
    ],
    synthesis: {
      status: "warn",
      confidence: 0.2,
      blocking_issues: [blockingIssue],
      next_actions: ["Regenerate this run before using the bounded agent section for operational review."]
    }
  };
}
