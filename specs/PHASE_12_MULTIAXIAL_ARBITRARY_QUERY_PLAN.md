# Phase 12 Multi-Axial Plan: Scope-Agnostic Arbitrary Query Runtime

Status: started.

The next product gap is not another vertical. The harness must accept arbitrary, messy, user-provided questions and transform them into auditable analysis runs without pretending every query belongs to a predefined pack.

## Product Thesis

Crux becomes production-viable when it can reliably answer: "Can this arbitrary query be turned into a safe, inspectable, evidence-aware analysis run, and what assumptions did the harness make?"

## Axis 1: Query Intake And Normalization

Goal: Convert raw user questions into explicit run inputs.

Required capabilities:

- Accept raw query strings through CLI, SDK, and API.
- Classify intent: decision, diagnostic, comparison, planning, research, or open exploration.
- Infer complexity, risk level, time horizon, and source needs.
- Generate conservative defaults for context, output goal, constraints, and assumptions.
- Preserve the original query in a machine-readable intake artifact.

Optimal first implementation:

- Add deterministic `query-intake` module.
- Add `crux query "<question>"`.
- Write `query_intake.json` into every run created from a raw query.
- Generate a normal `input.yaml` so replay, diff, report, eval, and review continue to work.

## Axis 2: Scope-Agnostic Runtime Behavior

Goal: Unknown scopes must be handled as generic analysis, not forced into an unrelated vertical profile.

Required capabilities:

- Add a generic scope profile.
- Use dynamic subject extraction from the user question.
- Keep pack resolution optional.
- Preserve traceability from original query to generated assumptions.

Optimal first implementation:

- Replace the old strategic-tech fallback with a generated generic profile.
- Make `analysis_scope: general-analysis` the default for arbitrary queries.

## Axis 3: Answerability And Safety Gating

Goal: The harness must know when a query is ambiguous, high stakes, or source-dependent.

Required capabilities:

- Flag queries that need clarification.
- Flag high-stakes domains such as medical, legal, financial, security, or safety.
- Require stronger source plans for high-stakes or time-sensitive queries.
- Keep the run possible, but make limitations explicit.

Optimal first implementation:

- Add deterministic `answerability` and `risk_level` fields to `query_intake.json`.
- Add clarifying questions and source questions as structured arrays.

## Axis 4: Evidence Planning

Goal: Arbitrary queries need evidence requirements even before source ingestion exists.

Required capabilities:

- Produce source questions from the query.
- Distinguish internal data, expert input, documents, web/current sources, and calculations.
- Explain when offline placeholder evidence is insufficient.

Optimal first implementation:

- Store source needs in `query_intake.json`.
- Add generated source/evidence constraints into the normalized input.

## Axis 5: Eval And Trust

Goal: Generic runs need quality checks that are not vertical-specific.

Required capabilities:

- Evaluate whether assumptions are explicit.
- Penalize unsupported certainty.
- Ensure diagnostics point to intake, evidence, memo, or source gaps.

Optimal first implementation:

- Reuse current eval council and diagnostics.
- Add E2E coverage proving arbitrary query runs still produce valid artifacts and inspectable limitations.

## Axis 6: Product Surfaces

Goal: Raw-query use should feel like the main product path.

Required capabilities:

- CLI: `crux query`.
- SDK: `createQueryRun`.
- API: `POST /queries`.
- Static report surfaces original query and assumptions.

Optimal first implementation:

- Start with CLI and core module.
- Add SDK/API in the next slice once the intake artifact is stable.

## Phase 12 Acceptance Criteria

- `crux query "<question>"` creates a complete run.
- The generated run includes `query_intake.json`.
- Unknown scopes use generic analysis behavior, not an unrelated vertical.
- Replay, inspect, report, review, eval, and release verification remain compatible.
- Tests cover normal arbitrary queries, ambiguous queries, high-stakes queries, and CLI execution.

## Current Convergence

This is the best next phase because it addresses the exact product gap: arbitrary user queries. It preserves the working harness instead of replacing it, adds a trust boundary before the pipeline, and creates a path toward real production usability without hard-coding domains.

I do not know a better next phase. The highest-leverage improvement is making arbitrary query intake explicit, inspectable, and testable.
