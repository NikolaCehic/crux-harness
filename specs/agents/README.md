# Bounded Agent Specs

Crux agents are bounded specialist reviewers that operate over run artifacts. They do not replace the harness, browse the web, call tools independently, or mutate external state. Their job is to make the run more inspectable by emitting structured findings, blocking issues, recommendations, and next actions.

The runtime manifest in `src/agents.ts` is the machine contract. These Markdown files are the human contract. Tests enforce that every runtime agent has a matching spec and that key manifest fields stay in sync.

## Agents

- [Research Scout](research_scout.md): source gap planning.
- [Evidence Auditor](evidence_auditor.md): claim support and evidence traceability.
- [Red Team Agent](red_team_agent.md): recommendation pressure testing.
- [Council Moderator](council_moderator.md): cross-agent synthesis.
- [Replay Planner](replay_planner.md): next-run improvement planning.
- [Eval Scenario Agent](eval_scenario_agent.md): regression and adversarial scenario design.

## Required Spec Sections

Every agent spec must include:

- Purpose
- Runtime Stage
- Allowed Inputs
- Produced Outputs
- Autonomy Boundary
- Decision Rubric
- Pass Criteria
- Warn Criteria
- Fail Criteria
- Blocking Issues
- Recommendations It May Emit
- Failure Modes
- Example
- Test Coverage
- Version Notes

