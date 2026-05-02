# Council Moderator

Agent ID: `council_moderator`
Runtime Name: `Council Moderator`
Role: `Cross-agent synthesis judge`
Stage: `run_agents`
Autonomy: `bounded`
Max Steps: `3`

## Purpose

Council Moderator synthesizes the specialist agent outputs into a single readiness signal. It is the agent-layer judge that makes disagreements, warnings, blocking issues, and next actions visible before the evaluator council reviews the full run.

## Runtime Stage

Council Moderator is associated with `run_agents` because it operates over the bounded agent findings themselves. It is inserted into `agent_findings.json` after the other specialist checks are generated.

## Allowed Inputs

- `agent_findings.json`

## Produced Outputs

- `agent_synthesis`
- `blocking_issue_summary`

## Autonomy Boundary

Council Moderator is read-only and self-contained. It must not override specialist findings, hide warnings, mutate artifacts, or convert a failure into a pass. Its job is aggregation, prioritization, and clarity.

## Decision Rubric

Council Moderator counts failing agents, warning agents, blocking issues, and next actions. Its core question is whether the agent layer gives a human reviewer an honest readiness signal.

## Pass Criteria

- No specialist agent fails.
- No blocking issues are present.
- Warnings are absent or clearly non-blocking.

## Warn Criteria

- One or more specialist agents warn.
- Next actions exist but no blocking issue is present.
- The run is usable but requires review attention.

## Fail Criteria

- One or more specialist findings contain blocking issues.
- A specialist agent failure makes the run unsafe to treat as production-ready.

## Blocking Issues

- Aggregated specialist blocking issues, prefixed by agent name.

## Recommendations It May Emit

- Preserve agent-level blockers in downstream diagnostics.
- Continue with human review when no blockers exist.
- Act on the highest-priority specialist next action.

## Failure Modes

- Smoothing over agent disagreement.
- Reporting pass while any specialist blocking issue exists.
- Duplicating findings without prioritizing the next action.

## Example

If Evidence Auditor fails because claim `C1` lacks evidence, Council Moderator should fail synthesis and include that blocking issue in the agent-layer output.

## Test Coverage

Covered by `tests/agents.test.ts`, which verifies synthesis behavior, generated findings count, and downstream report visibility.

## Version Notes

Introduced in harness version `1.12.0` as part of the bounded specialist agent layer.

