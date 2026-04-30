# Phase 2 Implementation Log: Modular Agent Runtime

This log records implementation decisions and file-level changes for Phase 2 so the work can be backtracked safely.

## 2026-04-30: Start Phase 2

Goal:

- Introduce a formal stage module runtime without rewriting the entire pipeline at once.
- Preserve all v1.1 behavior while adding module metadata, selection, timeout/retry execution, and trace visibility.

Planned first slice:

1. Add failing tests for stage module registry, LLM selection metadata, runtime retry behavior, and trace metadata.
2. Add `src/stages/types.ts`.
3. Add `src/stages/registry.ts`.
4. Add `src/stages/runtime.ts`.
5. Extend `run_config.json` with selected stage modules.
6. Route existing pipeline stages through the runtime wrapper.
7. Update docs and changelog.
8. Verify with `npm test` and `npm run benchmark`.

Backtrack note:

- This slice should not change artifact semantics.
- If anything regresses, revert the runtime wrapper and keep the stage metadata files isolated.

## 2026-04-30: Runtime Core Added

Files changed:

- `src/stages/types.ts`: added stage names, stage module metadata type, registry type, run result type, and trace metadata helper.
- `src/stages/registry.ts`: added deterministic modules for all existing pipeline stages and LLM module metadata for claim decomposition and evidence mapping.
- `src/stages/runtime.ts`: added `runStageModule` with timeout and retry behavior.
- `src/run-config.ts`: added selected stage modules to `run_config.json` and bumped harness version to `1.2.0`.
- `schemas/run_config.schema.json`: added `stages` array validation.
- `src/pipeline.ts`: routed all existing stages through `runStageModule` and added module metadata to start/complete trace events.
- `tests/stage-runtime.test.ts`: added registry, LLM selection, retry, and pipeline trace/run-config tests.
- `CHANGELOG.md`, `README.md`, `package.json`, `package-lock.json`: documented and versioned the Phase 2 slice.

Backtrack note:

- The runtime wrapper is centralized in `runStage`.
- Reverting pipeline runtime behavior should only require restoring `runStage` to direct `work()` execution and removing `stages` from `run_config.json`.

Verification:

- `npm test`: 29/29 passing.
- `npm run benchmark`: 7/7 scenarios passing, 0 regressions.
- `npm run crux -- inspect runs/latest`: integrity pass, harness version 1.2.0.

## 2026-04-30: Start Stage Adapter Slice

Goal:

- Move from runtime metadata around inline closures to real replaceable stage adapters.
- Keep the same artifact semantics and benchmark scores.
- Add typed `run()` methods for current deterministic stage behavior.

Planned files:

- `src/stages/adapters.ts`: stage adapter construction and stage-specific input/output types.
- `tests/stage-adapters.test.ts`: tests proving adapters are executable, deterministic, and registry-backed.
- `src/pipeline.ts`: refactor stage execution to call adapters instead of inline artifact builders.

Backtrack note:

- If adapter refactor regresses artifacts, restore `src/pipeline.ts` from commit `e6bc75f` and keep adapter files for a smaller follow-up slice.

## 2026-04-30: Stage Adapters Executed By Pipeline

Files changed:

- `src/stages/types.ts`: added `StageAdapter` and `StageAdapterContext`.
- `src/stages/adapters.ts`: added executable adapters for all current stages.
- `src/pipeline.ts`: refactored stage execution to call adapter `run()` methods through `runStageModule`.
- `tests/stage-adapters.test.ts`: added adapter execution tests for question normalization, source ingestion, claim graph generation, and evidence generation.
- `package.json`, `package-lock.json`, `src/cli.ts`, `src/run-config.ts`, `tests/v1.test.ts`: bumped harness version to `1.2.1`.
- `README.md`, `CHANGELOG.md`: documented the adapter execution slice.

Backtrack note:

- The adapter entry point is `createStageAdapters`.
- To backtrack, restore `src/pipeline.ts` to the `e6bc75f` runtime-wrapper version and leave adapter tests skipped until the adapter layer is reintroduced.

Verification:

- `npm test`: 31/31 passing.
- `npm run benchmark`: 7/7 scenarios passing, 0 regressions.
- `npm run crux -- inspect runs/latest`: integrity pass, harness version 1.2.1.

Optimality checkpoint:

- This is the smallest useful adapter slice because it makes stages executable through typed modules without changing artifact semantics.
- I do not know how to make this slice better without prematurely splitting every stage into a larger directory hierarchy or introducing external runtime dependencies before the local adapter contract is proven.
