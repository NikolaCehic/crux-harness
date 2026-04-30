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

Check replay compatibility without creating a new run:

```bash
npm run crux -- replay --check runs/latest
```

Inspect a run:

```bash
npm run crux -- inspect runs/latest
```

Write a static HTML run inspector:

```bash
npm run crux -- report runs/latest --out runs/latest/run_report.html
```

Record human review:

```bash
npm run crux -- review claim runs/latest C2 --status rejected --reviewer analyst --rationale "Needs stronger evidence."
npm run crux -- review evidence runs/latest E1 --reviewer analyst --note "Useful direction, limited proof."
npm run crux -- review export runs/latest --out reviewed_memo.md
```

List and inspect vertical packs:

```bash
npm run crux -- packs list
npm run crux -- packs inspect product-strategy
```

Verify and install local marketplace packs:

```bash
npm run crux -- marketplace list
npm run crux -- marketplace verify
npm run crux -- marketplace install packs/product-strategy/pack.json --to packs
```

Start the local API server:

```bash
npm run crux -- api --host 127.0.0.1 --port 4317
```

Run the local API through Docker Compose:

```bash
docker compose up --build
```

Compare two runs:

```bash
npm run crux -- diff runs/run-a runs/run-b
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

Crux v1.10 is a product-grade local harness for auditable, source-grounded analysis-agent runs. It remains deterministic by default, with optional LLM mappers behind strict schemas and provenance checks.

Every run writes `run_config.json`, which locks the harness version, input hash, source policy, budgets, mapper selection, and prompt versions.

The pipeline now runs through typed stage adapters and records selected stage modules for every major stage, including module ID, version, kind, timeout, retry policy, and optional prompt/model/provider metadata.

Run configs also include artifact contract metadata, and Crux can check replay compatibility or compare two runs for prompt, source, budget, mapper, stage, and artifact-contract drift.

The deterministic generator is scope-aware for benchmark coverage. It supports strategic technology, investment diligence, policy analysis, product strategy, scientific thesis evaluation, market entry, and root-cause analysis scenarios.

All seven benchmark scenarios now use local source packs, write `source_inventory.json` and `source_chunks.json`, and require source-backed evidence instead of placeholder evidence.

Raw Markdown, TXT, and CSV files can be imported into source packs with `crux sources import`.

Source-pack runs cite stable chunk IDs like `S1#chunk-001`, and integrity checks reject forged excerpts that do not appear in cited source chunks.

The evaluator includes schema validity, claim graph integrity, claim coverage, evidence traceability, source quality, contradiction handling, red-team strength, uncertainty quality, faithfulness, crux quality, and decision usefulness.

`eval_report.json` also includes a deterministic evaluator council. The council preserves specialist reviewer outputs for evidence, claim graph quality, faithfulness, red-team strength, uncertainty, decision utility, domain fit, and synthesis. The synthesis judge reports pass/warn/fail status, blocking failures, next fixes, and preserved disagreements instead of hiding everything in one score.

Eval reports include structured diagnostics with stage, severity, category, message, and recommended fix fields so users can see whether a failure came from evidence gathering, claim graph construction, memo writing, uncertainty modeling, red teaming, or evaluation itself.

Crux can also write a static HTML run inspector with `crux report <runDir>`. The report links the decision memo, root claims, claim graph, evidence, source excerpts, contradictions, uncertainty, eval council, diagnostics, and trace timeline without requiring a hosted app.

Human review is captured in `review.json` as a sidecar artifact. Reviewers can approve or reject claims, annotate evidence, and export a reviewed memo that clearly separates human review from the original machine-generated memo.

Vertical packs live under `packs/<pack-name>/pack.json`. Packs define source requirements, claim taxonomies, expected evidence, known failure modes, eval rubrics, memo sections, and benchmark links without hard-coding domains into the core harness.

External systems can call Crux through the local API server or the TypeScript `CruxLocalSdk`. The first API slice supports creating runs, fetching JSON/text artifacts, and fetching eval reports from the same contracts used by the CLI.

Self-hosted deployment starts with Docker Compose. The container runs the local API, stores generated runs in a Docker volume, and keeps provider secrets in environment variables instead of materializing secret values into configuration output.

The local marketplace registry lives in `marketplace/marketplace.json`. Marketplace entries declare source paths, certification status, harness major compatibility, and artifact-version requirements so reusable packs can extend Crux without weakening core contracts.

Crux includes optional LLM claim and evidence mappers behind the same validation boundary. Deterministic mapping remains the default. To opt in manually, set:

```bash
CRUX_CLAIM_DECOMPOSER=llm
CRUX_EVIDENCE_MAPPER=llm
CRUX_LLM_PROVIDER=openai-compatible
CRUX_LLM_API_KEY=...
CRUX_LLM_MODEL=...
```

LLM output is accepted only if it parses as strict JSON and passes schema plus provenance checks.
