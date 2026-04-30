import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EvidenceArtifact, EvidenceItem, ClaimsArtifact, RunInput, SourceChunksArtifact, SourceInventory, SourceItem } from "./types.js";
import type { EvidenceMapperSelection, LlmClient } from "./llm.js";

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

export type LlmEvidenceMapperInput = {
  input: RunInput;
  claims: ClaimsArtifact;
  sourceInventory: SourceInventory;
  sourceChunks: SourceChunksArtifact;
  llm: LlmClient;
  projectRoot?: string;
};

export async function mapEvidenceWithLlm(options: LlmEvidenceMapperInput): Promise<EvidenceArtifact> {
  const prompt = await buildEvidenceMapperPrompt(options);
  const output = await options.llm.completeJson({
    system: "You map source chunks to Crux claims and return strict JSON only.",
    prompt,
    metadata: {
      stage: "evidence_mapper",
      prompt_version: "evidence-mapper.v1",
      source_count: options.sourceInventory.sources.length,
      chunk_count: options.sourceChunks.chunks.length,
      claim_count: options.claims.claims.length
    }
  });

  return parseLlmEvidenceOutput(output, options);
}

export function selectEvidenceMapper(options: { env?: Record<string, string | undefined> }): EvidenceMapperSelection {
  const env = options.env ?? process.env;
  if (env.CRUX_EVIDENCE_MAPPER !== "llm") {
    return { type: "deterministic", reason: "CRUX_EVIDENCE_MAPPER is not set to llm." };
  }

  if (!env.CRUX_LLM_PROVIDER) {
    return { type: "deterministic", reason: "CRUX_LLM_PROVIDER is not configured." };
  }

  if (env.CRUX_LLM_PROVIDER !== "openai-compatible") {
    return { type: "deterministic", reason: `Unsupported LLM provider: ${env.CRUX_LLM_PROVIDER}.` };
  }

  if (!env.CRUX_LLM_API_KEY) {
    return { type: "deterministic", reason: "CRUX_LLM_API_KEY is not configured." };
  }

  return { type: "llm", reason: "LLM evidence mapper requested and provider is configured." };
}

async function buildEvidenceMapperPrompt(options: LlmEvidenceMapperInput): Promise<string> {
  const template = await loadPrompt(options.projectRoot);
  return [
    template,
    "",
    "## Question",
    options.input.question,
    "",
    "## Claims",
    JSON.stringify(options.claims.claims.map((claim) => ({
      id: claim.id,
      text: claim.text,
      type: claim.type,
      importance: claim.importance
    })), null, 2),
    "",
    "## Sources",
    JSON.stringify(options.sourceInventory.sources, null, 2),
    "",
    "## Source Chunks",
    JSON.stringify(options.sourceChunks.chunks.map((chunk) => ({
      id: chunk.id,
      source_id: chunk.source_id,
      text: chunk.text
    })), null, 2)
  ].join("\n");
}

async function loadPrompt(projectRoot = process.cwd()): Promise<string> {
  return readFile(path.join(projectRoot, "prompts", "evidence-mapper.md"), "utf8");
}

function parseLlmEvidenceOutput(output: unknown, options: LlmEvidenceMapperInput): EvidenceArtifact {
  if (!isObject(output) || !Array.isArray(output.evidence)) {
    throw new Error("LLM evidence mapper output must be an object with an evidence array.");
  }

  const claimIds = new Set(options.claims.claims.map((claim) => claim.id));
  const sources = new Map(options.sourceInventory.sources.map((source) => [source.id, source]));
  const chunks = new Map(options.sourceChunks.chunks.map((chunk) => [chunk.id, chunk]));

  const evidenceItems = output.evidence.map((rawItem, index) => {
    if (!isObject(rawItem)) {
      throw new Error(`LLM evidence item at index ${index} must be an object.`);
    }

    const id = requireString(rawItem, "id", index);
    const sourceId = requireString(rawItem, "source_id", index);
    const chunkId = requireString(rawItem, "chunk_id", index);
    const excerpt = requireString(rawItem, "excerpt", index);
    const summary = requireString(rawItem, "summary", index);
    const supports = requireStringArray(rawItem, "supports_claim_ids", index);
    const challenges = requireStringArray(rawItem, "challenges_claim_ids", index);
    const source = sources.get(sourceId);
    const chunk = chunks.get(chunkId);

    if (!source) {
      throw new Error(`LLM evidence ${id} references unknown source ${sourceId}.`);
    }
    if (!chunk) {
      throw new Error(`LLM evidence ${id} references unknown chunk ${chunkId}.`);
    }
    if (chunk.source_id !== sourceId) {
      throw new Error(`LLM evidence ${id} chunk ${chunkId} does not belong to source ${sourceId}.`);
    }
    if (!normalizeForExcerpt(chunk.text).includes(normalizeForExcerpt(excerpt))) {
      throw new Error(`LLM evidence ${id} excerpt is not present in cited chunk ${chunkId}.`);
    }

    for (const claimId of [...supports, ...challenges]) {
      if (!claimIds.has(claimId)) {
        throw new Error(`LLM evidence ${id} references unknown claim ${claimId}.`);
      }
    }

    return evidence(id, source, summary, supports, challenges, excerpt, [chunkId]);
  });

  return { evidence: evidenceItems };
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(item: Record<string, unknown>, key: string, index: number): string {
  const value = item[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`LLM evidence item ${index} missing required string field ${key}.`);
  }

  return value;
}

function requireStringArray(item: Record<string, unknown>, key: string, index: number): string[] {
  const value = item[key];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`LLM evidence item ${index} missing required string array field ${key}.`);
  }

  return value;
}

function normalizeForExcerpt(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}
