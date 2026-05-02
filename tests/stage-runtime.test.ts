import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createStageModuleRegistry } from "../src/stages/registry.js";
import { runStageModule } from "../src/stages/runtime.js";
import type { StageModule } from "../src/stages/types.js";
import { runHarness } from "../src/pipeline.js";

const projectRoot = process.cwd();

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("stage module registry defaults every pipeline stage to deterministic modules", () => {
  const registry = createStageModuleRegistry({
    claimDecomposer: { type: "deterministic", reason: "test" },
    evidenceMapper: { type: "deterministic", reason: "test" },
    llmConfigured: false
  });

  assert.deepEqual(registry.modules.map((module) => module.stage), [
    "normalize_question",
    "ingest_sources",
    "build_claim_graph",
    "gather_evidence",
    "verify_claims",
    "red_team",
    "model_uncertainty",
    "write_decision_memo",
    "run_agents",
    "evaluate"
  ]);
  assert.equal(registry.get("build_claim_graph").kind, "deterministic");
  assert.equal(registry.get("gather_evidence").kind, "deterministic");
});

test("stage module registry selects LLM metadata only when configured", () => {
  const registry = createStageModuleRegistry({
    claimDecomposer: { type: "llm", reason: "configured" },
    evidenceMapper: { type: "llm", reason: "configured" },
    llmConfigured: true,
    provider: "openai-compatible",
    model: "test-model"
  });

  const claimModule = registry.get("build_claim_graph");
  const evidenceModule = registry.get("gather_evidence");
  assert.equal(claimModule.kind, "llm");
  assert.equal(claimModule.module_id, "llm.claim-decomposer");
  assert.equal(claimModule.provider, "openai-compatible");
  assert.equal(claimModule.model, "test-model");
  assert.equal(evidenceModule.kind, "llm");
  assert.equal(evidenceModule.prompt_version, "evidence-mapper.v1");
});

test("runStageModule records attempts and retries failed work", async () => {
  let calls = 0;
  const module: StageModule = {
    stage: "normalize_question",
    module_id: "test.retry-module",
    module_version: "0.0.0",
    kind: "deterministic",
    timeout_ms: 1000,
    max_retries: 1
  };

  const result = await runStageModule(module, async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error("transient failure");
    }
    return "ok";
  });

  assert.equal(result.value, "ok");
  assert.equal(result.attempts, 2);
  assert.equal(result.module.module_id, "test.retry-module");
});

test("pipeline trace and run_config record selected stage modules", async () => {
  const result = await runHarness(projectRoot, "examples/frontier-agent-platform.yaml");
  const runConfig = JSON.parse(await readFile(path.join(result.runDir, "run_config.json"), "utf8"));
  assert.equal(runConfig.stages.length, 10);
  assert.equal(runConfig.stages.some((stage: { stage: string; module_id: string }) => {
    return stage.stage === "build_claim_graph" && stage.module_id === "deterministic.claim-decomposer";
  }), true);

  const traceLines = (await readFile(path.join(result.runDir, "trace.jsonl"), "utf8")).trim().split("\n");
  const traceEvents = traceLines.map((line) => JSON.parse(line));
  assert.equal(traceEvents.every((event) => {
    if (event.event_type !== "start" && event.event_type !== "complete") {
      return true;
    }
    return typeof event.metadata.module_id === "string" && typeof event.metadata.module_version === "string";
  }), true);
});
