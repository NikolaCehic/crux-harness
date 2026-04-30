import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildRunInputFromQuery, runQuery } from "../src/query-intake.js";
import { buildQuestionSpec } from "../src/artifacts.js";
import { validateRunIntegrity } from "../src/integrity.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
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

test("query intake turns an arbitrary question into a generic run input", () => {
  const normalized = buildRunInputFromQuery("Should we replace our internal support search with a long-context model next quarter?");

  assert.equal(normalized.input.analysis_scope, "general-analysis");
  assert.equal(normalized.input.source_policy, "hybrid");
  assert.equal(normalized.intake.intent, "decision");
  assert.equal(normalized.intake.complexity, "moderate");
  assert.equal(normalized.intake.risk_level, "medium");
  assert.equal(normalized.intake.answerability, "answerable_with_assumptions");
  assert.equal(normalized.input.decision_context.includes("scope-agnostic"), true);
  assert.equal(normalized.input.known_constraints?.some((constraint) => constraint.includes("No vertical pack selected")), true);
});

test("query intake flags ambiguous and high-stakes arbitrary queries", () => {
  const ambiguous = buildRunInputFromQuery("What should we do?");
  assert.equal(ambiguous.intake.answerability, "needs_clarification");
  assert.equal(ambiguous.intake.clarifying_questions.length >= 2, true);

  const highStakes = buildRunInputFromQuery("Should I stop taking my prescribed medication if the side effects are bad?");
  assert.equal(highStakes.intake.risk_level, "high");
  assert.equal(highStakes.intake.source_needs.some((need) => need.source_type === "expert_input"), true);
  assert.equal(highStakes.intake.assumptions.some((assumption) => assumption.includes("high-stakes")), true);
});

test("unknown scopes use generic question behavior instead of a vertical fallback", () => {
  const spec = buildQuestionSpec({
    analysis_scope: "custom-biotech-operations",
    question: "How should a biotech lab reduce sample contamination without slowing throughput?",
    decision_context: "A lab operations team needs a practical diagnosis.",
    time_horizon: "8 weeks",
    output_goal: "analysis memo",
    source_policy: "offline"
  });

  assert.equal(spec.decision_type, "scope-agnostic analysis");
  assert.equal(spec.decision_owner, "user or accountable decision maker");
  assert.equal(spec.context.includes("lab operations"), true);
  assert.equal(spec.constraints.some((constraint) => constraint.includes("custom-biotech-operations")), true);
  assert.equal(spec.unknowns.some((unknown) => unknown.includes("sample contamination")), true);
});

test("runQuery creates a complete audited run with query_intake.json", async () => {
  const result = await runQuery(projectRoot, "How should a support team triage a sudden spike in refund requests?", {
    context: "A marketplace operations lead needs a practical response plan.",
    timeHorizon: "14 days"
  });

  assert.equal(existsSync(path.join(result.runDir, "query_intake.json")), true);
  const intake = JSON.parse(await readFile(path.join(result.runDir, "query_intake.json"), "utf8"));
  assert.equal(intake.schema_version, "crux.query_intake.v1");
  assert.equal(intake.original_query.includes("refund requests"), true);

  const runConfig = JSON.parse(await readFile(path.join(result.runDir, "run_config.json"), "utf8"));
  assert.equal(runConfig.artifact_contract.artifacts.some((artifact: { name: string; required: boolean }) => {
    return artifact.name === "query_intake.json" && artifact.required === false;
  }), true);

  const integrity = await validateRunIntegrity(projectRoot, result.runDir);
  assert.deepEqual(integrity.failures, []);
  assert.equal(integrity.valid, true);
});

test("compiled CLI accepts raw arbitrary queries", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [cliPath, "query", "Should our operations team automate invoice approvals this quarter?", "--context", "A finance operations lead is deciding where to apply automation.", "--time-horizon", "90 days"],
    { cwd: projectRoot, env: deterministicEnv }
  );

  assert.match(stdout, /Query run complete:/);
  assert.match(stdout, /Intent: decision/);
  assert.match(stdout, /Scope: general-analysis/);
  const runMatch = stdout.match(/Query run complete: (.+)/);
  assert.ok(runMatch, "query command should print the run directory");
  const runDir = runMatch[1].trim();
  assert.equal(existsSync(path.join(projectRoot, runDir, "query_intake.json")), true);
});
