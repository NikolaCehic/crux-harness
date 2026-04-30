# Extensive E2E Test Strategy

Status: implemented as the release-gate testing spine.

This suite exists to prove Crux as a real harness, not only a set of passing unit tests. The optimal testing approach is a layered E2E system: golden benchmarks prove decision quality, contract checks prove artifact trust, black-box journeys prove product usability, adversarial fixtures prove failure detection, and one release command proves the whole system is shippable.

## Test Layers

1. Golden scenario benchmark
   - Runs the committed decision scenarios in `e2e/scenarios`.
   - Checks benchmark expectations in `e2e/expectations`.
   - Compares score and artifact-count regressions against `e2e/baselines/current.json`.

2. Extended expectation DSL
   - Verifies required artifacts.
   - Verifies evaluator council role coverage.
   - Requires or forbids diagnostics.
   - Requires trace stages.
   - Requires static report anchors.
   - Asserts expected failure diagnostics.
   - Asserts human review summary state when review artifacts exist.

3. Black-box product journeys
   - Exercises the compiled CLI the same way a user would.
   - Covers run, inspect, static report, review, reviewed memo export, replay compatibility, and run diff.

4. Adversarial broken-run suite
   - Mutates valid runs into known-bad runs.
   - Proves forged source excerpts, copied-input hash drift, and weak red-team output are caught.

5. Release gate
   - `npm run release:verify`
   - Runs TypeScript checking, unit and integration tests, the nested E2E suites, the golden benchmark, and marketplace compatibility verification.

## Commands

```sh
npm test
npm run test:e2e
npm run test:journeys
npm run test:adversarial
npm run benchmark
npm run release:verify
```

## Expectation DSL Additions

```json
{
  "required_artifacts": ["run_config.json", "eval_report.json", "trace.jsonl"],
  "required_eval_council_roles": ["evidence_auditor", "synthesis_judge"],
  "required_diagnostics": ["weak_red_team"],
  "forbidden_diagnostics": ["faithfulness"],
  "required_trace_stages": ["normalize_question", "evaluate"],
  "required_report_anchors": ["summary", "memo", "eval", "trace"],
  "expected_failure": {
    "stage": "red_team",
    "category": "weak_red_team",
    "severity": "high"
  },
  "required_review_summary": {
    "approved_claims": ["C1"],
    "rejected_claims": ["C2"],
    "evidence_annotations": ["E1"],
    "stage_rerun_requests": ["write_decision_memo"]
  }
}
```

## Why This Is The Current Optimum

This gives the harness four kinds of confidence at once: quality stability, artifact correctness, user workflow validity, and failure-mode detection. It stays fully deterministic, uses current repository surfaces, does not require hosted infrastructure, and can scale into per-pack or per-vertical certification later without replacing the test architecture.

I do not know a better E2E shape for this stage of the product. The next optimization would be adding more certified scenarios and mutation classes, not changing the structure.
