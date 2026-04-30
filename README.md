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

## v1 Objective

Given a strategic thesis or hard decision question, Crux should produce a complete run folder:

```text
runs/<run_id>/
  input.yaml
  run_config.json
  question_spec.json
  source_inventory.json
  source_chunks.json
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
- [v1 Acceptance](specs/V1_ACCEPTANCE.md)
- [Release Checklist](specs/RELEASE_CHECKLIST.md)

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

Inspect a run:

```bash
npm run crux -- inspect runs/latest
```

Import raw source files into a Crux source pack:

```bash
npm run crux -- sources import ./my-raw-sources --out sources/my-analysis
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

Crux v1.1 is a product-grade local harness for auditable, source-grounded analysis-agent runs. It remains deterministic by default, with optional LLM mappers behind strict schemas and provenance checks.

Every run writes `run_config.json`, which locks the harness version, input hash, source policy, budgets, mapper selection, and prompt versions.

The deterministic generator is scope-aware for benchmark coverage. It supports strategic technology, investment diligence, policy analysis, product strategy, scientific thesis evaluation, market entry, and root-cause analysis scenarios.

All seven benchmark scenarios now use local source packs, write `source_inventory.json` and `source_chunks.json`, and require source-backed evidence instead of placeholder evidence.

Raw Markdown, TXT, and CSV files can be imported into source packs with `crux sources import`.

Source-pack runs cite stable chunk IDs like `S1#chunk-001`, and integrity checks reject forged excerpts that do not appear in cited source chunks.

The evaluator includes schema validity, claim graph integrity, claim coverage, evidence traceability, source quality, contradiction handling, red-team strength, uncertainty quality, faithfulness, crux quality, and decision usefulness.

Crux includes optional LLM claim and evidence mappers behind the same validation boundary. Deterministic mapping remains the default. To opt in manually, set:

```bash
CRUX_CLAIM_DECOMPOSER=llm
CRUX_EVIDENCE_MAPPER=llm
CRUX_LLM_PROVIDER=openai-compatible
CRUX_LLM_API_KEY=...
CRUX_LLM_MODEL=...
```

LLM output is accepted only if it parses as strict JSON and passes schema plus provenance checks.
