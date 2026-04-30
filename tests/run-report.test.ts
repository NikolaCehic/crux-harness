import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { renderRunReportHtml } from "../src/run-report.js";
import { loadRunArtifactBundle } from "../src/run-bundle.js";
import { runHarness } from "../src/pipeline.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";
const cliPath = "dist/src/cli.js";
const deterministicEnv = {
  ...process.env,
  CRUX_CLAIM_DECOMPOSER: "deterministic",
  CRUX_EVIDENCE_MAPPER: "deterministic",
  CRUX_LLM_PROVIDER: "",
  CRUX_LLM_API_KEY: ""
};

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("loadRunArtifactBundle builds a linked run inspection bundle", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const bundle = await loadRunArtifactBundle(projectRoot, result.runDir);
  const sourceBackedEvidence = bundle.evidence.evidence.find((item) => (item.source_ids ?? []).length > 0 && (item.chunk_ids ?? []).length > 0);

  assert.equal(bundle.summary.claim_count, 12);
  assert.equal(bundle.summary.evidence_count, 8);
  assert.equal(bundle.summary.source_count, 5);
  assert.equal(bundle.summary.diagnostic_count, 0);
  assert.ok(sourceBackedEvidence);
  assert.equal(bundle.relationships.evidence_ids_by_claim_id.C1.length > 0, true);
  assert.equal(bundle.relationships.source_ids_by_evidence_id[sourceBackedEvidence.id].length > 0, true);
});

test("renderRunReportHtml links memo, claims, evidence, sources, eval, diagnostics, and trace", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const bundle = await loadRunArtifactBundle(projectRoot, result.runDir);
  const sourceBackedEvidence = bundle.evidence.evidence.find((item) => (item.source_ids ?? []).length > 0);
  assert.ok(sourceBackedEvidence);

  const html = renderRunReportHtml(bundle);

  assert.match(html, /<title>Crux Run Inspector<\/title>/);
  assert.match(html, /id="memo"/);
  assert.match(html, /id="claim-C1"/);
  assert.match(html, /href="#evidence-/);
  assert.match(html, new RegExp(`id="evidence-${sourceBackedEvidence.id}"`));
  assert.match(html, /href="#source-S[0-9]+"/);
  assert.match(html, /id="eval"/);
  assert.match(html, /id="diagnostics"/);
  assert.match(html, /id="trace"/);
});

test("compiled CLI writes a static run inspector report", async () => {
  const run = await runHarness(projectRoot, exampleInput);
  const reportPath = path.join("test-results", `run-report-${process.pid}-${Date.now()}.html`);
  const { stdout } = await execFileAsync(process.execPath, [cliPath, "report", path.relative(projectRoot, run.runDir), "--out", reportPath], {
    cwd: projectRoot,
    env: deterministicEnv
  });

  assert.match(stdout, new RegExp(`Report written: ${reportPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.equal(existsSync(path.join(projectRoot, reportPath)), true);

  const html = await readFile(path.join(projectRoot, reportPath), "utf8");
  assert.match(html, /Crux Run Inspector/);
  assert.match(html, /Council/);
  assert.match(html, /Claim Graph/);
  assert.match(html, /Evidence/);
});
