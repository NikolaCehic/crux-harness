import type { EvidenceArtifact, EvidenceItem, RunInput, SourceChunksArtifact, SourceInventory, SourceItem } from "./types.js";

type SourceRef = {
  sourceId: string;
  chunkId: string;
  excerpt: string;
};

export function mapSourceGroundedEvidence(
  input: RunInput,
  sourceInventory: SourceInventory,
  sourceChunks: SourceChunksArtifact
): EvidenceArtifact {
  const scope = input.analysis_scope ?? input.scenario_id ?? "source-grounded";
  const sources = new Map(sourceInventory.sources.map((source) => [source.id, source]));
  const chunkIds = new Set(sourceChunks.chunks.map((chunk) => chunk.id));

  const sourceEvidence = (
    id: string,
    ref: SourceRef,
    summary: string,
    supports: string[],
    challenges: string[] = []
  ): EvidenceItem => {
    if (!chunkIds.has(ref.chunkId)) {
      throw new Error(`Evidence ${id} references missing source chunk ${ref.chunkId}`);
    }

    return evidence(
      id,
      requireSource(sources, ref.sourceId),
      summary,
      supports,
      challenges,
      ref.excerpt,
      [ref.chunkId]
    );
  };

  return {
    evidence: [
      sourceEvidence(
        "E1",
        {
          sourceId: "S1",
          chunkId: "S1#chunk-001",
          excerpt: "23 percent of respondents report scaling an agentic AI system somewhere in the enterprise"
        },
        "McKinsey reports meaningful enterprise agent experimentation and scaling activity, which supports the claim that demand is plausible but still early.",
        ["C2"]
      ),
      sourceEvidence(
        "E2",
        {
          sourceId: "S1",
          chunkId: "S1#chunk-002",
          excerpt: "only 39 percent reporting EBIT impact at the enterprise level"
        },
        "McKinsey also reports limited enterprise-level EBIT impact, which challenges any assumption that broad AI adoption already guarantees enterprise agent platform ROI.",
        ["C2", "C5"],
        ["C1"]
      ),
      sourceEvidence(
        "E3",
        {
          sourceId: "S3",
          chunkId: "S3#chunk-002",
          excerpt: "multi-agent workflows, guardrails for input and output validation, and tracing for debugging and optimization"
        },
        "OpenAI's agent tooling emphasizes orchestration, guardrails, tracing, and observability, supporting reliability and evaluation as plausible technical wedges.",
        ["C3", "C6", "C7", "C12"]
      ),
      sourceEvidence(
        "E4",
        {
          sourceId: "S5",
          chunkId: "S5#chunk-002",
          excerpt: "Microsoft 365 Agent Store and Copilot integration"
        },
        "Microsoft's agent distribution inside Microsoft 365 suggests incumbent platforms can bundle agent capabilities into existing enterprise workflows.",
        ["C4", "C8", "C11"]
      ),
      sourceEvidence(
        "E5",
        {
          sourceId: "S2",
          chunkId: "S2#chunk-001",
          excerpt: "only 15 percent are considering, piloting, or deploying fully autonomous AI agents"
        },
        "Gartner reports that fully autonomous agents are much less mature than general piloting, with governance and maturity concerns limiting deployment.",
        ["C4", "C5", "C7"],
        ["C1", "C3", "C12"]
      ),
      {
        id: "E6",
        source_type: "calculation",
        citation: `${scope} staged validation logic`,
        summary: "Given the sourced evidence of demand, immature scaling, governance constraints, and incumbent distribution, a narrow design-partner test is lower-risk than broad platform buildout.",
        supports_claim_ids: ["C6", "C9", "C10"],
        challenges_claim_ids: [],
        reliability: 0.72,
        recency: 0.82,
        relevance: 0.86,
        limitations: "Reasoned synthesis over source-backed evidence; should be replaced by quantitative pilot data when available."
      },
      sourceEvidence(
        "E7",
        {
          sourceId: "S4",
          chunkId: "S4#chunk-001",
          excerpt: "execution state saved to persistent storage"
        },
        "LangGraph's durable execution documentation supports the view that persistence and recovery are concrete reliability concerns for agent workflows.",
        ["C3", "C7", "C12"]
      ),
      sourceEvidence(
        "E8",
        {
          sourceId: "S2",
          chunkId: "S2#chunk-002",
          excerpt: "governance, maturity, and agent sprawl as concerns"
        },
        "Gartner's governance and agent-sprawl concerns support using design partners to validate scope control, governance readiness, and buyer urgency before scaling.",
        ["C9", "C10", "C12"]
      )
    ]
  };
}

function evidence(
  id: string,
  source: SourceItem,
  summary: string,
  supports_claim_ids: string[],
  challenges_claim_ids: string[],
  excerpt: string,
  chunk_ids: string[]
): EvidenceItem {
  return {
    id,
    source_type: source.source_type,
    citation: source.citation,
    summary,
    source_ids: [source.id],
    chunk_ids,
    excerpt,
    supports_claim_ids,
    challenges_claim_ids,
    reliability: source.reliability,
    recency: source.recency,
    relevance: source.relevance,
    limitations: "Source-backed evidence from local source pack."
  };
}

function requireSource(sources: Map<string, SourceItem>, sourceId: string): SourceItem {
  const source = sources.get(sourceId);
  if (!source) {
    throw new Error(`Source pack is missing required source ${sourceId}`);
  }

  return source;
}

