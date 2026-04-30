# Crux Harness

**A production-grade agent harness for auditable, decision-quality analysis.**

Crux turns open-ended questions into inspectable analysis runs: normalized questions, claim graphs, evidence maps, contradictions, uncertainty models, red-team critiques, decision memos, evaluator diagnostics, and replayable run contracts.

It is built for the problem every serious analysis agent eventually faces:

> How do you trust, inspect, replay, evaluate, and improve what the agent did?

Crux does not treat the final memo as the product. The product is the full reasoning trail.

## Why Crux Exists

Most analysis agents produce a polished answer and leave you guessing how they got there.

Crux produces a run folder with structured artifacts, schemas, trace events, eval scores, diagnostics, human review state, and replay metadata. Every important claim can be inspected. Every run can be checked. Every failure can be diagnosed.

Crux is for building agents that need to be more than impressive. They need to be accountable.

## What It Produces

Every run creates an auditable artifact bundle:

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

Runs created from raw arbitrary queries also include:

```text
query_intake.json
```

Optional review and inspection artifacts include:

```text
review.json
reviewed_memo.md
run_report.html
```

## Core Flow

```text
raw question
-> query intake
-> normalized question spec
-> claim graph
-> source inventory and chunks
-> evidence map
-> contradiction analysis
-> red team
-> uncertainty model
-> decision memo
-> evaluator council
-> diagnostics
-> replayable run contract
```

## Highlights

- **Arbitrary query intake**: `crux query` turns raw user questions into structured, scope-agnostic analysis runs.
- **Auditable artifacts**: claims, evidence, contradictions, uncertainty, red-team critique, memo, eval, and trace are all persisted.
- **Schema-enforced contracts**: JSON artifacts are validated against explicit schemas.
- **Replay and diff**: runs can be replayed and compared for prompt, mapper, source, stage, budget, and artifact-contract drift.
- **Evaluator council**: specialist reviewers assess evidence, claim graph quality, faithfulness, red-team strength, uncertainty, decision utility, domain fit, and synthesis.
- **Diagnostics**: failures are classified by stage, severity, category, message, and recommended fix.
- **Human review**: reviewers can approve/reject claims, annotate evidence, and export reviewed memos without overwriting machine artifacts.
- **Static inspector**: generate a self-contained HTML run report.
- **API and SDK**: run creation and artifact access are available through the HTTP API and TypeScript SDK.
- **Self-hosted deployment**: Docker Compose provides a straightforward deployment path.
- **Release gate**: `npm run release:verify` runs the full verification suite.

## Quickstart

Install dependencies:

```bash
npm install
```

Run an arbitrary query:

```bash
npm run crux -- ask "Should our operations team automate invoice approvals this quarter?" \
  --context "A finance operations lead is choosing the next automation target." \
  --time-horizon "90 days"
```

Install the `crux` command on your machine:

```bash
npm run build
npm link
crux ask "How should a support team triage a sudden spike in refund requests?"
```

Run a structured scenario:

```bash
npm run crux -- run examples/frontier-agent-platform.yaml
```

Inspect the latest run:

```bash
npm run crux -- inspect runs/latest
```

Generate an HTML run report:

```bash
npm run crux -- report runs/latest --out runs/latest/run_report.html
```

Run the full release gate:

```bash
npm run release:verify
```

## Arbitrary Query Intake

Crux can start from a raw question instead of a prewritten YAML file:

```bash
npm run crux -- ask "How should a support team triage a sudden spike in refund requests?"
```

The query intake layer writes `query_intake.json` and records:

- original query
- normalized query
- inferred intent
- complexity
- risk level
- answerability
- assumptions
- clarifying questions
- source needs
- generated run input

Unknown scopes use a generic scope-agnostic profile. Crux does not force arbitrary questions into unrelated vertical templates.

## Trust Model

Crux separates generation from verification.

The pipeline creates artifacts. The validator checks schemas and cross-artifact integrity. The evaluator scores analysis quality. The council preserves specialist reviewer judgments. Diagnostics explain what failed and how to fix it.

The trust boundary is explicit:

```text
artifact contracts
schema validation
source provenance checks
replay compatibility
run comparison
eval council
diagnostics
human review
E2E release gate
```

This makes Crux suitable for agent workflows where analysis quality, auditability, and iteration matter.

## CLI

Ask an arbitrary question:

```bash
npm run crux -- ask "Should we replace our internal support search with a long-context model next quarter?"
```

Or, after `npm link`:

```bash
crux ask "Should we replace our internal support search with a long-context model next quarter?"
```

Run from YAML:

```bash
npm run crux -- run examples/frontier-agent-platform.yaml
```

Evaluate an existing run:

```bash
npm run crux -- eval runs/latest
```

Replay a run:

```bash
npm run crux -- replay runs/latest
```

Check replay compatibility:

```bash
npm run crux -- replay --check runs/latest
```

Compare two runs:

```bash
npm run crux -- diff runs/run-a runs/run-b
```

Import raw source files:

```bash
npm run crux -- sources import ./my-raw-sources --out sources/my-analysis
```

Record human review:

```bash
npm run crux -- review claim runs/latest C2 --status rejected --reviewer analyst --rationale "Needs stronger evidence."
npm run crux -- review evidence runs/latest E1 --reviewer analyst --note "Useful direction, limited proof."
npm run crux -- review export runs/latest --out reviewed_memo.md
```

List and inspect packs:

```bash
npm run crux -- packs list
npm run crux -- packs inspect product-strategy
```

Verify marketplace compatibility:

```bash
npm run crux -- marketplace list
npm run crux -- marketplace verify
```

Start the API server:

```bash
npm run crux -- api --host 127.0.0.1 --port 4317
```

Run with Docker Compose:

```bash
docker compose up --build
```

## Evaluation

`eval_report.json` includes:

- schema validity
- claim graph integrity
- claim coverage
- evidence traceability
- source quality
- contradiction handling
- red-team strength
- uncertainty quality
- faithfulness
- crux quality
- decision usefulness

It also includes:

- structured diagnostics
- evaluator council reviewers
- preserved disagreements
- synthesis status
- blocking failures
- recommended next fixes

## Testing And Release

Run the standard suite:

```bash
npm test
```

Run the extended E2E tiers:

```bash
npm run test:e2e
npm run test:journeys
npm run test:adversarial
```

Run the benchmark suite:

```bash
npm run benchmark
```

Run the full release gate:

```bash
npm run release:verify
```

The release gate checks TypeScript, unit and integration tests, E2E expectation DSL coverage, black-box product journeys, adversarial broken-run fixtures, benchmark regressions, and marketplace compatibility.

## LLM Mappers

Crux is deterministic by default. Optional LLM claim and evidence mappers can be enabled behind the same schema and provenance boundaries:

```bash
CRUX_CLAIM_DECOMPOSER=llm
CRUX_EVIDENCE_MAPPER=llm
CRUX_LLM_PROVIDER=openai-compatible
CRUX_LLM_API_KEY=...
CRUX_LLM_MODEL=...
```

LLM output is accepted only if it parses as strict JSON and passes validation.

## Specs

- [Product Spec](specs/PRODUCT_SPEC.md)
- [Artifact Spec](specs/ARTIFACT_SPEC.md)
- [Run Spec](specs/RUN_SPEC.md)
- [Eval Spec](specs/EVAL_SPEC.md)
- [E2E Test Strategy](specs/E2E_TEST_STRATEGY.md)
- [Phase 12 Arbitrary Query Plan](specs/PHASE_12_MULTIAXIAL_ARBITRARY_QUERY_PLAN.md)
- [Release Checklist](specs/RELEASE_CHECKLIST.md)

## Status

Crux v1.11 is a working production-grade agent harness for auditable analysis runs.

The current frontier is source connectivity and production platform surfaces: richer source acquisition, stronger high-stakes policies, hosted observability, multi-user permissions, and deeper deployment automation.
