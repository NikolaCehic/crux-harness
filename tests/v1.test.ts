import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { evaluateRun } from "../src/evaluator.js";
import { validateRunIntegrity } from "../src/integrity.js";
import { runHarness } from "../src/pipeline.js";

const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("v1 runs lock configuration and expose enhanced eval scores", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const runConfigPath = path.join(result.runDir, "run_config.json");
  assert.equal(existsSync(runConfigPath), true);

  const runConfig = JSON.parse(await readFile(runConfigPath, "utf8"));
  assert.equal(runConfig.schema_version, "crux.run_config.v1");
  assert.equal(runConfig.harness_version, "1.2.1");
  assert.equal(runConfig.mappers.claim_decomposer.type, "deterministic");
  assert.equal(runConfig.mappers.evidence_mapper.type, "deterministic");
  assert.equal(runConfig.prompts.evidence_mapper, "evidence-mapper.v1");

  const evalReport = JSON.parse(await readFile(path.join(result.runDir, "eval_report.json"), "utf8"));
  assert.equal(evalReport.scores.faithfulness, 1);
  assert.equal(evalReport.scores.crux_quality >= 0.9, true);

  const integrity = await validateRunIntegrity(projectRoot, result.runDir);
  assert.deepEqual(integrity.failures, []);
});

test("faithfulness eval flags unsupported certainty added to the memo", async () => {
  const result = await runHarness(projectRoot, exampleInput);
  const memoPath = path.join(result.runDir, "decision_memo.md");
  const memo = await readFile(memoPath, "utf8");
  await writeFile(memoPath, `${memo}\n\nThis opportunity is guaranteed and has no risk.\n`, "utf8");

  const evalReport = await evaluateRun(projectRoot, result.runDir);
  assert.equal(evalReport.scores.faithfulness < 1, true);
  assert.equal(evalReport.failed_checks.some((check) => check.toLowerCase().includes("faithfulness")), true);
});

test("integrity rejects claim graph self-dependencies and dependency cycles", async () => {
  const selfDependencyRun = await runHarness(projectRoot, exampleInput);
  const selfClaimsPath = path.join(selfDependencyRun.runDir, "claims.json");
  const selfClaims = JSON.parse(await readFile(selfClaimsPath, "utf8"));
  selfClaims.claims[1].depends_on = [selfClaims.claims[1].id];
  await writeFile(selfClaimsPath, `${JSON.stringify(selfClaims, null, 2)}\n`, "utf8");

  const selfIntegrity = await validateRunIntegrity(projectRoot, selfDependencyRun.runDir);
  assert.equal(selfIntegrity.valid, false);
  assert.equal(selfIntegrity.failures.some((failure) => failure.includes("depends on itself")), true);

  const cycleRun = await runHarness(projectRoot, exampleInput);
  const cycleClaimsPath = path.join(cycleRun.runDir, "claims.json");
  const cycleClaims = JSON.parse(await readFile(cycleClaimsPath, "utf8"));
  cycleClaims.claims.find((claim: { id: string }) => claim.id === "C2").depends_on = ["C3"];
  cycleClaims.claims.find((claim: { id: string }) => claim.id === "C3").depends_on = ["C2"];
  await writeFile(cycleClaimsPath, `${JSON.stringify(cycleClaims, null, 2)}\n`, "utf8");

  const cycleIntegrity = await validateRunIntegrity(projectRoot, cycleRun.runDir);
  assert.equal(cycleIntegrity.valid, false);
  assert.equal(cycleIntegrity.failures.some((failure) => failure.includes("dependency cycle")), true);
});
