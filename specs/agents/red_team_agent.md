# Red Team Agent

Agent ID: `red_team_agent`
Runtime Name: `Red Team Agent`
Role: `Recommendation breaker`
Stage: `red_team`
Autonomy: `bounded`
Max Steps: `5`

## Purpose

Red Team Agent pressure-tests the recommendation and verifies that serious objections affect the decision memo. It is not a second answer generator. It checks whether the run preserved opposing arguments, failure modes, missing evidence, and recommendation impact.

## Runtime Stage

Red Team Agent is associated with `red_team` because it reviews the red-team critique and its propagation into `decision_memo.md`. It runs inside the bounded agent layer after the memo exists.

## Allowed Inputs

- `claims.json`
- `evidence.json`
- `contradictions.json`
- `red_team.md`
- `decision_memo.md`

## Produced Outputs

- `counterargument_findings`
- `failure_mode_actions`

## Autonomy Boundary

Red Team Agent is read-only. It must not rewrite the recommendation, alter claims, or create new evidence. It may only flag missing critique structure, weak recommendation impact, and next actions for strengthening the run.

## Decision Rubric

Red Team Agent checks whether `red_team.md` includes opposing thesis, strongest counterarguments, failure modes, missing evidence, and recommendation impact. It also checks whether the decision memo visibly incorporates red-team findings.

## Pass Criteria

- Required red-team sections are present.
- The memo includes a red-team findings section.
- The recommendation is staged or qualified when objections are material.

## Warn Criteria

- Required red-team sections are missing.
- The red-team critique exists but does not clearly affect the memo.
- Failure modes are too generic to guide action.

## Fail Criteria

Current runtime behavior warns rather than fails for weak red-team output. Future versions may fail when the memo makes a high-risk recommendation without preserving material objections.

## Blocking Issues

Red Team Agent currently emits warnings and next actions, not blocking issues. Blocking should be introduced only when the harness has declared risk thresholds for mandatory red-team failure.

## Recommendations It May Emit

- Strengthen red-team output.
- Propagate recommendation impact into the decision memo.
- Rewrite red-team impact before treating the run as reviewed.

## Failure Modes

- Producing polite criticism that does not threaten the recommendation.
- Listing objections without changing the memo.
- Treating missing evidence as a footnote instead of a decision condition.

## Example

If `red_team.md` lacks `## Failure Modes` or the memo does not include red-team impact, Red Team Agent should warn and ask for the critique to be strengthened before review.

## Test Coverage

Covered by `tests/agents.test.ts`, run-report tests, and evaluator diagnostics that surface agent findings in downstream inspection.

## Version Notes

Introduced in harness version `1.12.0` as part of the bounded specialist agent layer.

