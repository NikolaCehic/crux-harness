import assert from "node:assert/strict";
import test from "node:test";
import { buildClaims } from "../src/artifacts.js";
import { mapEvidenceWithLlm, selectEvidenceMapper } from "../src/evidence-mapper.js";
import { buildSourceChunks, buildSourceInventory } from "../src/sources.js";
import type { LlmClient } from "../src/llm.js";

const projectRoot = process.cwd();
const input = {
  question: "Should a frontier AI startup build an enterprise agent platform in 2026?",
  decision_context: "A seed-stage technical team is choosing its primary product strategy.",
  time_horizon: "12 months",
  output_goal: "decision memo",
  scenario_id: "strategic-tech",
  analysis_scope: "strategic-tech",
  source_pack: "sources/strategic-tech"
};

test("mapEvidenceWithLlm converts strict JSON output into source-backed evidence", async () => {
  const inventory = await buildSourceInventory(projectRoot, input);
  const chunks = await buildSourceChunks(projectRoot, inventory);
  const claims = buildClaims(input);
  const llm: LlmClient = {
    completeJson: async () => ({
      evidence: [
        {
          id: "E1",
          source_id: "S1",
          chunk_id: "S1#chunk-001",
          excerpt: "23 percent of respondents report scaling an agentic AI system somewhere in the enterprise",
          summary: "McKinsey supports meaningful enterprise agent experimentation and early scaling.",
          supports_claim_ids: ["C2"],
          challenges_claim_ids: []
        }
      ]
    })
  };

  const artifact = await mapEvidenceWithLlm({ input, claims, sourceInventory: inventory, sourceChunks: chunks, llm });
  assert.equal(artifact.evidence.length, 1);
  assert.equal(artifact.evidence[0].source_ids?.[0], "S1");
  assert.equal(artifact.evidence[0].chunk_ids?.[0], "S1#chunk-001");
  assert.equal(artifact.evidence[0].citation, inventory.sources.find((source) => source.id === "S1")?.citation);
});

test("mapEvidenceWithLlm rejects output whose excerpt is not in the cited chunk", async () => {
  const inventory = await buildSourceInventory(projectRoot, input);
  const chunks = await buildSourceChunks(projectRoot, inventory);
  const claims = buildClaims(input);
  const llm: LlmClient = {
    completeJson: async () => ({
      evidence: [
        {
          id: "E1",
          source_id: "S1",
          chunk_id: "S1#chunk-001",
          excerpt: "This exact excerpt is fabricated.",
          summary: "This should not pass provenance verification.",
          supports_claim_ids: ["C2"],
          challenges_claim_ids: []
        }
      ]
    })
  };

  await assert.rejects(
    () => mapEvidenceWithLlm({ input, claims, sourceInventory: inventory, sourceChunks: chunks, llm }),
    /excerpt is not present/
  );
});

test("mapEvidenceWithLlm rejects malformed strict JSON shape", async () => {
  const inventory = await buildSourceInventory(projectRoot, input);
  const chunks = await buildSourceChunks(projectRoot, inventory);
  const claims = buildClaims(input);
  const llm: LlmClient = {
    completeJson: async () => ({ items: [] })
  };

  await assert.rejects(
    () => mapEvidenceWithLlm({ input, claims, sourceInventory: inventory, sourceChunks: chunks, llm }),
    /evidence array/
  );
});

test("selectEvidenceMapper defaults to deterministic mode without LLM configuration", () => {
  assert.equal(selectEvidenceMapper({ env: {} }).type, "deterministic");
  assert.equal(selectEvidenceMapper({ env: { CRUX_EVIDENCE_MAPPER: "llm" } }).type, "deterministic");
  assert.equal(selectEvidenceMapper({ env: { CRUX_EVIDENCE_MAPPER: "llm", CRUX_LLM_PROVIDER: "mock", CRUX_LLM_API_KEY: "test" } }).type, "deterministic");
  assert.equal(selectEvidenceMapper({ env: { CRUX_EVIDENCE_MAPPER: "llm", CRUX_LLM_PROVIDER: "openai-compatible" } }).type, "deterministic");
  assert.equal(selectEvidenceMapper({ env: { CRUX_EVIDENCE_MAPPER: "llm", CRUX_LLM_PROVIDER: "openai-compatible", CRUX_LLM_API_KEY: "test" } }).type, "llm");
});
