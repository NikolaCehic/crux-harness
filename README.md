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

