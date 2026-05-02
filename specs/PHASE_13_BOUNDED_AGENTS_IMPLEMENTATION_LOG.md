# Phase 13 Implementation Log: Bounded Specialist Agents

This log records the agent embedding slice so the change can be audited or backtracked.

## 2026-05-02: Bounded Agents Embedded Into The Harness

Goal:

- Add agents where they help quality without turning Crux into an opaque autonomous swarm.
- Keep agents bounded, deterministic, schema-validated, traceable, and inspectable.
- Preserve the core harness contract: artifacts first, evaluation second, human review last.

Design decision:

- Agents are embedded as a pipeline stage named `run_agents`.
- Agents do not browse, submit, mutate external state, or act outside their allowed artifact inputs.
- Each run records:
  - `agent_manifest.json`: the stable specialist definitions and limits.
  - `agent_findings.json`: the run-specific findings, blocking issues, recommendations, and next actions.

Agents added:

- `research_scout`: identifies source gaps and next evidence collection actions.
- `evidence_auditor`: checks important claim support and source-backed evidence coverage.
- `red_team_agent`: verifies red-team pressure and memo impact.
- `council_moderator`: synthesizes specialist agent failures and warnings.
- `replay_planner`: turns uncertainty and missing evidence into next-run improvements.
- `eval_scenario_agent`: suggests golden, adversarial, and regression E2E scenarios.

Files changed:

- `src/agents.ts`: added bounded agent definitions and deterministic run-specific agent reviews.
- `src/types.ts`: added agent manifest and findings artifact types.
- `src/stages/types.ts`: added `run_agents` to the stage registry.
- `src/stages/registry.ts`: added deterministic module metadata for `run_agents`.
- `src/stages/adapters.ts`: added executable `runAgents` adapter.
- `src/pipeline.ts`: writes `agent_manifest.json` and `agent_findings.json` before evaluation.
- `src/run-config.ts`: adds agent artifacts to the artifact contract and bumps harness version.
- `src/evaluator.ts`: reads optional agent findings and converts agent blockers into diagnostics.
- `src/inspect.ts`: prints bounded agent synthesis and reviewer statuses.
- `src/run-bundle.ts`: includes agent artifacts in run inspection bundles and keeps legacy runs inspectable when agent artifacts are absent.
- `src/run-report.ts`: adds a Bounded Agents section to the static HTML inspector.
- `schemas/agent_manifest.schema.json`: validates agent definitions and limits.
- `schemas/agent_findings.schema.json`: validates run-specific agent findings.
- `tests/agents.test.ts`: covers manifest, run findings, and weak-evidence synthesis behavior.
- Existing stage, harness, v1, and report tests were updated for the new required artifacts.

Verification:

- `npm run check` passed.
- `npm test` passed with 73 tests.
- `npm run test:e2e` passed.
- `npm run test:journeys` passed.
- `npm run test:adversarial` passed.
- `npm run benchmark` passed 7/7 scenarios with 0 regressions.
- `npm run crux -- marketplace verify` passed for all certified packs.
- `npm run release:verify` passed.

## 2026-05-02: Per-Agent Human Specs

Goal:

- Give every bounded agent its own detailed Markdown spec.
- Make Red Team Agent and Council Moderator explicit human-readable contracts, not only runtime entries.
- Prevent the runtime manifest and docs from drifting.

Files added:

- `specs/agents/README.md`: documents the bounded-agent spec contract and required sections.
- `specs/agents/research_scout.md`: source gap planner spec.
- `specs/agents/evidence_auditor.md`: claim support auditor spec.
- `specs/agents/red_team_agent.md`: recommendation breaker spec.
- `specs/agents/council_moderator.md`: cross-agent synthesis judge spec.
- `specs/agents/replay_planner.md`: run improvement planner spec.
- `specs/agents/eval_scenario_agent.md`: E2E test designer spec.

Guardrail added:

- `tests/agents.test.ts` now verifies that every runtime agent has a matching Markdown file and that ID, name, role, stage, max steps, allowed inputs, produced outputs, and required sections match the manifest.

Verification:

- `npm run release:verify` passed.
- `npm test` passed with 74 tests.
- `npm run benchmark` passed 7/7 scenarios with 0 regressions.

Backtrack note:

- To backtrack this documentation layer, remove `specs/agents/` and the spec drift test from `tests/agents.test.ts`.

Backtrack note:

- The feature is isolated around `src/agents.ts`, the `run_agents` stage, and two artifacts.
- To backtrack cleanly, remove `run_agents` from `src/stages/types.ts`, remove the adapter and registry case, remove the pipeline write block, and remove `agent_manifest.json` / `agent_findings.json` from the artifact contract.

Optimality checkpoint:

- This is the most conservative useful agent layer because agents are inspectable artifacts, not hidden autonomous control flow.
- I do not know a better way to add agents to Crux without reducing auditability or prematurely introducing external side effects.
