# Crux Harness

Crux is a spec-driven harness for building decision-grade analysis agents.

The goal is not to generate polished reports. The goal is to produce auditable reasoning artifacts: claims, evidence, uncertainty, counterarguments, decisions, and evaluations that can be inspected, replayed, and improved.

## Core Loop

```text
question
-> question spec
-> claim graph
-> evidence map
-> verification
-> red team
-> uncertainty model
-> decision memo
-> evaluation report
```

## v0.1 Objective

Given a strategic thesis or hard decision question, Crux should produce a complete run folder:

```text
runs/<run_id>/
  input.yaml
  question_spec.json
  claims.json
  evidence.json
  contradictions.json
  red_team.md
  uncertainty.json
  decision_memo.md
  eval_report.json
  trace.jsonl
```

## Spec Pack

- [Product Spec](specs/PRODUCT_SPEC.md)
- [Artifact Spec](specs/ARTIFACT_SPEC.md)
- [Run Spec](specs/RUN_SPEC.md)
- [Eval Spec](specs/EVAL_SPEC.md)
- [MVP Build Plan](specs/MVP_BUILD_PLAN.md)

## First Example

The initial benchmark input is:

- [examples/frontier-agent-platform.yaml](examples/frontier-agent-platform.yaml)

## Development

Install dependencies:

```bash
npm install
```

Run the example:

```bash
npm run crux -- run examples/frontier-agent-platform.yaml
```

Evaluate an existing run:

```bash
npm run crux -- eval runs/latest
```

Replay an existing run:

```bash
npm run crux -- replay runs/latest
```

Run tests:

```bash
npm test
```

Run the scoped E2E benchmark suite:

```bash
npm run benchmark
```

The benchmark executes all scenarios in `e2e/scenarios`, checks the matching invariants in `e2e/expectations`, validates cross-artifact integrity, compares scores against `e2e/baselines/current.json`, and fails loudly if a run breaks the reasoning contract or regresses past the threshold.

By default, `npm run benchmark` writes a machine-readable report to:

```text
test-results/benchmark-latest.json
```

You can also write an explicit report:

```bash
npm run crux -- benchmark --report test-results/benchmark.json
```

Use a custom regression threshold:

```bash
npm run crux -- benchmark --regression-threshold 0.05
```

## Current Implementation

Crux v0.1 is a deterministic harness. It generates complete placeholder artifacts that satisfy the run contract, then evaluates them.

The placeholder evidence is deliberately marked as limited. This version proves the harness shape before live research, model calls, and stronger evaluators are added.

The deterministic generator is scope-aware for benchmark coverage. It currently supports strategic technology, investment diligence, policy analysis, product strategy, scientific thesis evaluation, market entry, and root-cause analysis scenarios.
