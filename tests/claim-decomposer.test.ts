import assert from "node:assert/strict";
import test from "node:test";
import { decomposeClaimsWithLlm, selectClaimDecomposer } from "../src/claim-decomposer.js";
import type { LlmClient } from "../src/llm.js";

const input = {
  question: "Should a fund invest in a compliance automation startup?",
  decision_context: "A venture fund is deciding whether to proceed to deep diligence.",
  time_horizon: "18 months",
  output_goal: "investment diligence memo",
  scenario_id: "investment-diligence",
  analysis_scope: "investment-diligence"
};

test("decomposeClaimsWithLlm converts strict JSON output into a claim graph", async () => {
  const llm: LlmClient = {
    completeJson: async () => ({
      claims: [
        {
          id: "C1",
          text: "Proceed only if diligence proves urgent budget-backed compliance automation demand.",
          type: "decision",
          status: "contested",
          importance: 1,
          confidence: 0.62,
          depends_on: ["C2"],
          evidence_ids: ["E1"],
          counterevidence_ids: [],
          notes: "Root decision claim."
        },
        {
          id: "C2",
          text: "Compliance automation demand is plausible but not yet proven.",
          type: "descriptive",
          status: "weakly_supported",
          importance: 0.9,
          confidence: 0.64,
          depends_on: [],
          evidence_ids: ["E1"],
          counterevidence_ids: [],
          notes: "Demand claim."
        }
      ],
      edges: [{ from: "C2", to: "C1", relation: "supports" }],
      root_claim_ids: ["C1"]
    })
  };

  const artifact = await decomposeClaimsWithLlm({ input, llm });
  assert.equal(artifact.claims.length, 2);
  assert.deepEqual(artifact.root_claim_ids, ["C1"]);
});

test("decomposeClaimsWithLlm rejects malformed strict JSON shape", async () => {
  const llm: LlmClient = {
    completeJson: async () => ({ items: [] })
  };

  await assert.rejects(
    () => decomposeClaimsWithLlm({ input, llm }),
    /claims, edges, and root_claim_ids/
  );
});

test("selectClaimDecomposer defaults to deterministic mode without LLM configuration", () => {
  assert.equal(selectClaimDecomposer({ env: {} }).type, "deterministic");
  assert.equal(selectClaimDecomposer({ env: { CRUX_CLAIM_DECOMPOSER: "llm" } }).type, "deterministic");
  assert.equal(selectClaimDecomposer({ env: { CRUX_CLAIM_DECOMPOSER: "llm", CRUX_LLM_PROVIDER: "mock", CRUX_LLM_API_KEY: "test" } }).type, "deterministic");
  assert.equal(selectClaimDecomposer({ env: { CRUX_CLAIM_DECOMPOSER: "llm", CRUX_LLM_PROVIDER: "openai-compatible" } }).type, "deterministic");
  assert.equal(selectClaimDecomposer({ env: { CRUX_CLAIM_DECOMPOSER: "llm", CRUX_LLM_PROVIDER: "openai-compatible", CRUX_LLM_API_KEY: "test" } }).type, "llm");
});
