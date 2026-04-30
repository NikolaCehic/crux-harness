# Phase 6 Implementation Log: Human Review Workflow

This log records implementation decisions and file-level changes for Phase 6 so the work can be backtracked safely.

## 2026-04-30: Start Review Sidecar Slice

Goal:

- Add `review.json` as a schema-validated sidecar artifact.
- Let reviewers approve or reject claims.
- Let reviewers annotate evidence.
- Append review actions to `trace.jsonl`.
- Export a reviewed memo that distinguishes human review from machine output.

Planned files:

- `schemas/review.schema.json`: review artifact schema.
- `src/review.ts`: review persistence, summaries, trace events, and memo export.
- `src/types.ts`: review artifact and action types.
- `src/validator.ts`: review schema ID.
- `src/cli.ts`: `crux review` commands.
- `tests/review.test.ts`: TDD coverage for schema validity, claim review, evidence annotations, traceability, reviewed memo export, and CLI behavior.
- `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`: document and version the Phase 6 slice.

Backtrack note:

- `review.json` is a sidecar artifact. It does not mutate claims, evidence, eval reports, or decision memos.
- Review commands append to `trace.jsonl`, but do not alter prior trace events.
- Removing review commands leaves run generation, replay, eval, benchmark, and reporting unchanged.

## 2026-04-30: Review Sidecar Added

Files changed:

- `schemas/review.schema.json`: added schema for review actions, summaries, claim decisions, evidence annotations, and stage rerun requests.
- `src/review.ts`: added review initialization, claim approval/rejection, evidence annotation, trace events, summary derivation, and reviewed memo export.
- `src/types.ts`: added `ReviewArtifact` and `ReviewAction`.
- `src/validator.ts`: added `schemaIds.review`.
- `src/cli.ts`: added `crux review init`, `crux review claim`, `crux review evidence`, and `crux review export`.
- `tests/review.test.ts`: added tests for review schema validity, summaries, trace events, evidence notes, reviewed memo export, and compiled CLI behavior.
- `README.md`, `CHANGELOG.md`, `specs/PHASE_06_HUMAN_REVIEW_WORKFLOW_SPEC.md`, `package.json`, `package-lock.json`: documented and versioned the Phase 6 slice.

Verification:

- `npm test`: 48/48 passing.
- `npm run benchmark`: 7/7 benchmark scenarios passing, 0 regressions.
- `npm run crux -- review init runs/latest`: review initialized at `runs/latest/review.json`.
- `npm run crux -- review claim runs/latest C2 --status rejected --reviewer analyst --rationale "Needs stronger evidence."`: review action `R1` recorded.
- `npm run crux -- review export runs/latest --out reviewed_memo.md`: reviewed memo written to `runs/latest/reviewed_memo.md`.

Optimality checkpoint:

- This is the smallest useful Phase 6 slice because it captures human judgment without corrupting the original machine-generated run record.
- I do not know how to make this slice better without prematurely adding permissions, collaborative queues, or partial rerun orchestration before the review artifact contract is stable.
