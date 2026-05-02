import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildAgentManifest, runBoundedAgents } from "../src/agents.js";
import { runHarness } from "../src/pipeline.js";

const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";
const agentSpecDir = path.join(projectRoot, "specs", "agents");
const requiredAgentSpecSections = [
  "## Purpose",
  "## Runtime Stage",
  "## Allowed Inputs",
  "## Produced Outputs",
  "## Autonomy Boundary",
  "## Decision Rubric",
  "## Pass Criteria",
  "## Warn Criteria",
  "## Fail Criteria",
  "## Blocking Issues",
  "## Recommendations It May Emit",
  "## Failure Modes",
  "## Example",
  "## Test Coverage",
  "## Version Notes"
];

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("bounded agent manifest defines inspectable specialist agents", () => {
  const manifest = buildAgentManifest();

  assert.equal(manifest.schema_version, "crux.agent_manifest.v1");
  assert.equal(manifest.mode, "bounded");
  assert.deepEqual(manifest.agents.map((agent) => agent.agent_id), [
    "research_scout",
    "evidence_auditor",
    "red_team_agent",
    "council_moderator",
    "replay_planner",
    "eval_scenario_agent"
  ]);
  assert.equal(manifest.agents.every((agent) => agent.autonomy === "bounded"), true);
  assert.equal(manifest.agents.every((agent) => agent.limits.no_external_side_effects), true);
  assert.equal(manifest.agents.every((agent) => agent.allowed_inputs.length > 0), true);
});

test("bounded agent specs exist and stay aligned with the runtime manifest", async () => {
  const manifest = buildAgentManifest();
  const specFiles = (await readdir(agentSpecDir))
    .filter((file) => file.endsWith(".md") && file !== "README.md")
    .sort();

  assert.deepEqual(specFiles, manifest.agents.map((agent) => `${agent.agent_id}.md`).sort());

  for (const agent of manifest.agents) {
    const spec = await readFile(path.join(agentSpecDir, `${agent.agent_id}.md`), "utf8");

    assert.match(spec, new RegExp(`^# ${escapeRegExp(agent.name)}$`, "m"));
    assert.match(spec, new RegExp(`Agent ID: \`${escapeRegExp(agent.agent_id)}\``));
    assert.match(spec, new RegExp(`Runtime Name: \`${escapeRegExp(agent.name)}\``));
    assert.match(spec, new RegExp(`Role: \`${escapeRegExp(agent.role)}\``));
    assert.match(spec, new RegExp(`Stage: \`${escapeRegExp(agent.stage)}\``));
    assert.match(spec, new RegExp(`Autonomy: \`${agent.autonomy}\``));
    assert.match(spec, new RegExp(`Max Steps: \`${agent.limits.max_steps}\``));

    for (const section of requiredAgentSpecSections) {
      assert.match(spec, new RegExp(`^${escapeRegExp(section)}$`, "m"), `${agent.agent_id} is missing ${section}`);
    }

    for (const input of agent.allowed_inputs) {
      assert.match(spec, new RegExp(`- \`${escapeRegExp(input)}\``), `${agent.agent_id} spec is missing input ${input}`);
    }

    for (const output of agent.produced_outputs) {
      assert.match(spec, new RegExp(`- \`${escapeRegExp(output)}\``), `${agent.agent_id} spec is missing output ${output}`);
    }
  }
});

test("bounded agents emit run-specific findings without external side effects", async () => {
  const result = await runHarness(projectRoot, exampleInput);

  const agentManifest = JSON.parse(await readFile(path.join(result.runDir, "agent_manifest.json"), "utf8"));
  const agentFindings = JSON.parse(await readFile(path.join(result.runDir, "agent_findings.json"), "utf8"));
  const runConfig = JSON.parse(await readFile(path.join(result.runDir, "run_config.json"), "utf8"));
  const trace = (await readFile(path.join(result.runDir, "trace.jsonl"), "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

  assert.equal(agentManifest.agents.length, 6);
  assert.equal(agentFindings.schema_version, "crux.agent_findings.v1");
  assert.equal(agentFindings.findings.length, 6);
  assert.equal(agentFindings.findings.some((finding: { agent_id: string }) => finding.agent_id === "replay_planner"), true);
  assert.equal(agentFindings.synthesis.next_actions.length > 0, true);
  assert.equal(runConfig.stages.some((stage: { stage: string; module_id: string }) => {
    return stage.stage === "run_agents" && stage.module_id === "deterministic.bounded-agent-council";
  }), true);
  assert.equal(runConfig.artifact_contract.artifacts.some((artifact: { name: string }) => artifact.name === "agent_findings.json"), true);
  assert.equal(trace.some((event: { stage: string; event_type: string }) => event.stage === "run_agents" && event.event_type === "complete"), true);
  assert.equal(existsSync(path.join(result.runDir, "agent_findings.json")), true);
});

test("runBoundedAgents synthesizes blocking issues when evidence support is weak", () => {
  const manifest = buildAgentManifest();
  const findings = runBoundedAgents({
    runId: "test-run",
    manifest,
    questionSpec: {
      question: "Should we launch this product?",
      decision_type: "go/no-go",
      decision_owner: "Product",
      context: "No source material attached.",
      time_horizon: "30 days",
      success_criteria: ["Actable decision"],
      constraints: ["Analysis scope: product"],
      unknowns: ["Whether source-backed evidence exists."],
      required_artifacts: []
    },
    sourceInventory: {
      source_pack: { path: null, mode: "none" },
      sources: []
    },
    sourceChunks: {
      source_pack: { path: null, mode: "none" },
      chunks: []
    },
    claims: {
      claims: [
        {
          id: "C1",
          text: "Launch should proceed.",
          type: "decision",
          status: "supported",
          importance: 1,
          confidence: 0.9,
          depends_on: [],
          evidence_ids: [],
          counterevidence_ids: [],
          notes: "No evidence IDs."
        }
      ],
      edges: [],
      root_claim_ids: ["C1"]
    },
    evidence: { evidence: [] },
    contradictions: {
      contradictions: [],
      unsupported_critical_claims: ["C1"],
      missing_evidence: ["Customer proof"]
    },
    redTeam: "## Opposing Thesis\n\nNo evidence yet.",
    uncertainty: {
      overall_confidence: 0.4,
      key_uncertainties: [],
      sensitivity: [],
      what_would_change_my_mind: [],
      recommended_tests: []
    },
    decisionMemo: "## Recommendation\n\nProceed."
  });

  assert.equal(findings.synthesis.status, "fail");
  assert.equal(findings.synthesis.blocking_issues.some((issue) => issue.includes("Evidence Auditor")), true);
  assert.equal(findings.findings.find((finding) => finding.agent_id === "research_scout")?.status, "warn");
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
