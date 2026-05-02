import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildRunInputFromQuery, runQuery } from "../src/query-intake.js";
import { buildQuestionSpec } from "../src/artifacts.js";
import { inspectRun } from "../src/inspect.js";
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

test("query intake preserves an attached source pack for arbitrary questions", () => {
  const normalized = buildRunInputFromQuery(
    "Should we prioritize enterprise onboarding improvements this quarter?",
    {
      context: "The product team has source material from discovery and capacity planning.",
      sourcePolicy: "offline",
      sourcePack: "sources/product-strategy"
    }
  );

  assert.equal(normalized.input.source_pack, "sources/product-strategy");
  assert.equal(normalized.intake.generated_input.source_pack, "sources/product-strategy");
  assert.equal(normalized.intake.source_policy, "offline");
  assert.equal(normalized.intake.answerability, "answerable");
  assert.equal(normalized.input.known_constraints?.some((constraint) => constraint.includes("Attached source pack: sources/product-strategy")), true);
  assert.equal(normalized.intake.assumptions.some((assumption) => assumption.includes("placeholder evidence")), false);
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
  assert.equal(spec.success_criteria.some((criterion) => criterion.includes("reducing sample contamination")), true);
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

  const inspection = await inspectRun(projectRoot, result.runDir);
  assert.match(inspection, /Question: How should a support team triage a sudden spike in refund requests\?/);
  assert.match(inspection, /Scope: general-analysis/);
  assert.doesNotMatch(inspection, /Scenario: 20[0-9]{6}T[0-9]{6}Z-/);
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

test("compiled CLI ask command is the first-class arbitrary-question workflow", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      cliPath,
      "ask",
      "How should a facilities team reduce meeting-room overbooking without adding office space?",
      "--context",
      "A workplace operations lead needs a practical plan.",
      "--time-horizon",
      "30 days"
    ],
    { cwd: projectRoot, env: deterministicEnv }
  );

  assert.match(stdout, /Query run complete:/);
  assert.match(stdout, /Generated input:/);
  assert.match(stdout, /Query intake:/);
  assert.match(stdout, /Decision memo:/);
  assert.match(stdout, /HTML report:/);
  assert.match(stdout, /Trust gate:/);
  assert.match(stdout, /Memo preview:/);
  assert.match(stdout, /## Recommendation/);
  assert.doesNotMatch(stdout, /run gather/i);
  assert.doesNotMatch(stdout, /is attractive only if/i);
  assert.match(stdout, /Open the memo:/);
  const runMatch = stdout.match(/Query run complete: (.+)/);
  assert.ok(runMatch, "ask command should print the run directory");
  const runDir = runMatch[1].trim();
  assert.doesNotMatch(runDir, /T\d{6}Z-\d{8}T\d{6}Z-/);
  assert.equal(existsSync(path.join(projectRoot, runDir, "query_intake.json")), true);
  assert.equal(existsSync(path.join(projectRoot, runDir, "run_report.html")), true);
});

test("compiled CLI ask command can attach a source pack to arbitrary questions", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [
      cliPath,
      "ask",
      "Should we prioritize onboarding improvements this quarter?",
      "--context",
      "The product team is weighing customer activation and enterprise capacity constraints.",
      "--source-policy",
      "offline",
      "--source-pack",
      "sources/product-strategy"
    ],
    { cwd: projectRoot, env: deterministicEnv }
  );

  const runMatch = stdout.match(/Query run complete: (.+)/);
  assert.ok(runMatch, "ask command should print the run directory");
  const runDir = runMatch[1].trim();
  const runConfig = JSON.parse(await readFile(path.join(projectRoot, runDir, "run_config.json"), "utf8"));
  const sourceInventory = JSON.parse(await readFile(path.join(projectRoot, runDir, "source_inventory.json"), "utf8"));

  assert.equal(runConfig.source_pack, "sources/product-strategy");
  assert.equal(sourceInventory.sources.length, 3);
  assert.match(stdout, /Sources: 3/);
});
