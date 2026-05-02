# Replay Planner

Agent ID: `replay_planner`
Runtime Name: `Replay Planner`
Role: `Run improvement planner`
Stage: `replay`
Autonomy: `bounded`
Max Steps: `4`

## Purpose

Replay Planner turns uncertainty, missing evidence, and memo next tests into concrete improvements for the next run. It keeps Crux from ending at a single answer by making the next validation cycle explicit.

## Runtime Stage

Replay Planner is associated with `replay` because it prepares the run for comparison against a future version. It runs inside the bounded agent layer after uncertainty and the decision memo exist.

## Allowed Inputs

- `contradictions.json`
- `uncertainty.json`
- `decision_memo.md`

## Produced Outputs

- `replay_plan`
- `input_improvement_actions`

## Autonomy Boundary

Replay Planner is read-only. It does not create a replay, edit the input, or modify source packs. It only names what should change before the next run and how the reviewer should compare results.

## Decision Rubric

Replay Planner checks recommended tests, missing-evidence items, and whether the memo includes next tests. Its core question is whether the next run can measurably reduce uncertainty.

## Pass Criteria

- At least three concrete next actions are available.
- The memo includes next tests.
- Missing evidence and recommended tests are translated into replay work.

## Warn Criteria

- Fewer than three concrete next actions exist.
- The memo lacks a next-test section.
- Missing evidence is too vague to support a useful replay.

## Fail Criteria

Current runtime behavior warns rather than fails. Future versions may fail when a run has material uncertainty but no replayable next action.

## Blocking Issues

Replay Planner currently does not emit blocking issues. It should remain non-blocking unless replayability becomes a required gate for specific run classes.

## Recommendations It May Emit

- Add evidence for the top missing-evidence need.
- Compare the replay against the current run before accepting trust movement.
- Use recommended tests as the next validation cycle.

## Failure Modes

- Producing generic next steps that do not change the next run.
- Ignoring missing evidence from contradictions.
- Failing to connect uncertainty to a measurable replay.

## Example

If uncertainty recommends customer interviews and contradictions list missing customer proof, Replay Planner should name that as a next-run input improvement.

## Test Coverage

Covered by `tests/agents.test.ts` and run-report tests that require agent next actions to appear in inspection surfaces.

## Version Notes

Introduced in harness version `1.12.0` as part of the bounded specialist agent layer.

