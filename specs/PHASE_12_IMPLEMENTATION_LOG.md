# Phase 12 Implementation Log: Scope-Agnostic Arbitrary Query Runtime

Date: 2026-04-30

## Slice 1 Goal

Implement the first production-shaping slice of arbitrary query support:

- deterministic query intake
- generic scope fallback
- `crux query`
- query intake artifact
- TDD coverage

## Backtracking Notes

This slice is additive. If it needs to be reverted, remove:

- `src/query-intake.ts`
- `schemas/query_intake.schema.json`
- query-related tests
- `crux query` CLI command
- generic fallback changes in `src/artifacts.ts`
- optional `query_intake.json` handling in the pipeline and artifact contract

## Implementation Status

- Added deterministic query intake in `src/query-intake.ts`.
- Added `query_intake.json` schema validation.
- Added optional query intake artifact handling in the pipeline and artifact contract.
- Added `crux query` for raw arbitrary questions.
- Replaced unknown-scope vertical fallback with a generated generic profile.
- Added tests for raw query normalization, ambiguous queries, high-stakes queries, unknown-scope fallback, run creation, and CLI execution.

## Verification

- `npm run build`
- `node --test dist/tests/query-intake.test.js`

## Convergence Note

This is the optimal first implementation slice because it creates the missing trust boundary before the existing pipeline. It does not attempt to solve live research, hosted UX, or source acquisition prematurely; it makes arbitrary query transformation explicit, auditable, and testable first.
