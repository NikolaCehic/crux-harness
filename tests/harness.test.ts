import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { validateRunIntegrity } from "../src/integrity.js";
import { replayRun, rerunEvaluation, runHarness } from "../src/pipeline.js";

const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";

process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("runHarness creates a complete, schema-valid deterministic run", async () => {
  const result = await runHarness(projectRoot, exampleInput);

  for (const file of [
    "input.yaml",
    "run_config.json",
    "question_spec.json",
    "source_inventory.json",
    "source_chunks.json",
    "claims.json",
    "evidence.json",
    "contradictions.json",
    "red_team.md",
    "uncertainty.json",
    "decision_memo.md",
    "agent_manifest.json",
    "agent_findings.json",
    "eval_report.json",
    "trace.jsonl"
  ]) {
    assert.equal(existsSync(path.join(result.runDir, file)), true, `${file} should exist`);
  }

  const claims = JSON.parse(await readFile(path.join(result.runDir, "claims.json"), "utf8"));
  assert.equal(claims.claims.length, 12);
  assert.equal(claims.root_claim_ids.length, 3);

  const evidence = JSON.parse(await readFile(path.join(result.runDir, "evidence.json"), "utf8"));
  assert.equal(evidence.evidence.length, 8);
  assert.equal(evidence.evidence.filter((item: { source_ids?: string[] }) => (item.source_ids ?? []).length > 0).length >= 5, true);

  const sourceInventory = JSON.parse(await readFile(path.join(result.runDir, "source_inventory.json"), "utf8"));
  assert.equal(sourceInventory.sources.length, 5);

  const sourceChunks = JSON.parse(await readFile(path.join(result.runDir, "source_chunks.json"), "utf8"));
  assert.equal(sourceChunks.chunks.length >= 5, true);
  assert.equal(sourceChunks.chunks.every((chunk: { id: string; source_id: string; text: string }) => {
    return /^S[0-9]+#chunk-[0-9]{3}$/.test(chunk.id) && chunk.source_id && chunk.text.length > 0;
  }), true);
  assert.equal(evidence.evidence.filter((item: { chunk_ids?: string[] }) => (item.chunk_ids ?? []).length > 0).length >= 5, true);

  const evalReport = JSON.parse(await readFile(path.join(result.runDir, "eval_report.json"), "utf8"));
  assert.equal(evalReport.scores.schema_validity, 1);
  assert.deepEqual(evalReport.failed_checks, []);

  const agentFindings = JSON.parse(await readFile(path.join(result.runDir, "agent_findings.json"), "utf8"));
  assert.equal(agentFindings.findings.length, 6);
  assert.equal(["pass", "warn", "fail"].includes(agentFindings.synthesis.status), true);

  const traceLines = readFileSync(path.join(result.runDir, "trace.jsonl"), "utf8").trim().split("\n");
  assert.equal(traceLines.length >= 20, true);
  const traceEvents = traceLines.map((line) => JSON.parse(line));
  assert.equal(traceEvents.some((event) => {
    return event.stage === "gather_evidence" && event.event_type === "info" && event.metadata.mapper_type === "deterministic";
  }), true);

  const integrity = await validateRunIntegrity(projectRoot, result.runDir);
  assert.deepEqual(integrity.failures, []);
  assert.equal(integrity.valid, true);
});

test("run integrity rejects source-backed evidence with forged excerpts", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const evidencePath = path.join(result.runDir, "evidence.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  evidence.evidence[0].excerpt = "This sentence is not present in the cited source chunk.";
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  const integrity = await validateRunIntegrity(projectRoot, result.runDir);
  assert.equal(integrity.valid, false);
  assert.equal(integrity.failures.some((failure) => failure.includes("excerpt") && failure.includes("E1")), true);
});

test("run integrity rejects evidence whose chunks do not belong to cited sources", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const evidencePath = path.join(result.runDir, "evidence.json");
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  evidence.evidence[0].source_ids = ["S2"];
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  const integrity = await validateRunIntegrity(projectRoot, result.runDir);
  assert.equal(integrity.valid, false);
  assert.equal(integrity.failures.some((failure) => failure.includes("E1") && failure.includes("does not belong")), true);
});

test("rerunEvaluation rewrites eval_report.json for an existing run", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  await rerunEvaluation(projectRoot, path.relative(projectRoot, result.runDir));

  const evalReport = JSON.parse(await readFile(path.join(result.runDir, "eval_report.json"), "utf8"));
  assert.equal(evalReport.scores.schema_validity, 1);
  assert.equal(evalReport.failed_checks.length, 0);
});

test("replayRun creates a new run from a prior run input", async () => {
  const original = await runHarness(projectRoot, exampleInput);
  const replay = await replayRun(projectRoot, path.relative(projectRoot, original.runDir));

  assert.notEqual(replay.runDir, original.runDir);
  assert.equal(existsSync(path.join(replay.runDir, "decision_memo.md")), true);
});
