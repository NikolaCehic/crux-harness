import assert from "node:assert/strict";
import test from "node:test";
import { createStageModuleRegistry } from "../src/stages/registry.js";
import { createStageAdapters } from "../src/stages/adapters.js";

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

test("stage adapters expose executable modules for every registered stage", () => {
  const registry = createStageModuleRegistry({
    claimDecomposer: { type: "deterministic", reason: "test" },
    evidenceMapper: { type: "deterministic", reason: "test" },
    llmConfigured: false
  });
  const adapters = createStageAdapters(registry);

  assert.equal(adapters.normalizeQuestion.module_id, "deterministic.question-normalizer");
  assert.equal(typeof adapters.normalizeQuestion.run, "function");
  assert.equal(adapters.ingestSources.module_id, "deterministic.source-ingester");
  assert.equal(typeof adapters.evaluate.run, "function");
});

test("deterministic stage adapters produce source-grounded claims and evidence", async () => {
  const registry = createStageModuleRegistry({
    claimDecomposer: { type: "deterministic", reason: "test" },
    evidenceMapper: { type: "deterministic", reason: "test" },
    llmConfigured: false
  });
  const adapters = createStageAdapters(registry);
  const context = { projectRoot, runDir: projectRoot, input };

  const questionSpec = await adapters.normalizeQuestion.run(undefined, context);
  assert.equal(questionSpec.question, input.question);

  const { sourceInventory, sourceChunks } = await adapters.ingestSources.run(undefined, context);
  assert.equal(sourceInventory.sources.length, 5);
  assert.equal(sourceChunks.chunks.length >= 5, true);

  const claims = await adapters.buildClaimGraph.run({ sourceInventory, sourceChunks }, context);
  assert.equal(claims.claims.length, 12);

  const evidence = await adapters.gatherEvidence.run({ claims, sourceInventory, sourceChunks }, context);
  assert.equal(evidence.evidence.length, 8);
  assert.equal(evidence.evidence.filter((item) => (item.source_ids ?? []).length > 0).length >= 7, true);
});
