# Eval Scenario Agent

Agent ID: `eval_scenario_agent`
Runtime Name: `Eval Scenario Agent`
Role: `E2E test designer`
Stage: `evaluate`
Autonomy: `bounded`
Max Steps: `4`

## Purpose

Eval Scenario Agent suggests golden, adversarial, and regression scenarios that would test the run class. It connects a single run to the broader evaluation strategy so improvements become measurable.

## Runtime Stage

Eval Scenario Agent is associated with `evaluate` because it designs tests for evaluator coverage and product-grade regression checks. It runs inside the bounded agent layer before the formal evaluator council reads `agent_findings.json`.

## Allowed Inputs

- `run_config.json`
- `question_spec.json`
- `claims.json`
- `contradictions.json`
- `uncertainty.json`

## Produced Outputs

- `eval_scenario_suggestions`
- `adversarial_test_actions`

## Autonomy Boundary

Eval Scenario Agent is read-only. It does not create test files, mutate fixtures, or change benchmark thresholds. It emits scenario recommendations that humans or future automation can convert into tests.

## Decision Rubric

Eval Scenario Agent checks analysis scope, high-severity contradictions, and root claims. Its core question is whether this run suggests useful golden, adversarial, and regression tests.

## Pass Criteria

- A golden scenario is named.
- An adversarial scenario is tied to a root claim or important claim.
- A regression scenario names the trust movement to compare.
- High-severity contradiction behavior is testable.

## Warn Criteria

- No high-severity contradictions exist to exercise failure diagnostics.
- Root claims are missing or hard to mutate.
- Suggested scenarios are too generic to become tests.

## Fail Criteria

Current runtime behavior warns rather than fails. Future versions may fail if no root claim exists or the run cannot produce a meaningful adversarial mutation.

## Blocking Issues

Eval Scenario Agent currently does not emit blocking issues. Its output is advisory unless the release gate requires a new scenario for a changed run class.

## Recommendations It May Emit

- Add a golden scenario for this decision scope.
- Remove evidence for a root claim and require diagnostics.
- Replay after adding source material and compare trust movement.

## Failure Modes

- Suggesting tests that do not map to run artifacts.
- Ignoring root claims.
- Confusing product benchmarks with one-off manual checks.

## Example

For a source-backed strategic decision, Eval Scenario Agent should suggest a golden repeat, an adversarial missing-evidence mutation for the root claim, and a regression replay after sources improve.

## Test Coverage

Covered by `tests/agents.test.ts`, e2e expectation DSL tests, and release verification that exercises benchmark and adversarial suites.

## Version Notes

Introduced in harness version `1.12.0` as part of the bounded specialist agent layer.

