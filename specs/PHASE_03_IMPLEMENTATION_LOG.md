# Phase 3 Implementation Log: Harness Contract Layer

This log records implementation decisions and file-level changes for Phase 3 so the work can be backtracked safely.

## 2026-04-30: Start Run Contract Slice

Goal:

- Add artifact contract metadata to `run_config.json`.
- Add replay compatibility checks.
- Add run comparison primitives.
- Add CLI commands for inspecting compatibility and run diffs.

Planned files:

- `src/contracts.ts`: replay compatibility and run comparison utilities.
- `tests/contracts.test.ts`: contract metadata, replay compatibility, prompt/model drift, and CLI diff tests.
- `schemas/run_config.schema.json`: artifact contract metadata.
- `src/run-config.ts`: artifact contract metadata generation.
- `src/cli.ts`: `crux replay --check <runDir>` and `crux diff <runA> <runB>`.

Backtrack note:

- If the comparison shape is too noisy, keep artifact contract metadata and remove CLI diff first.
- The run comparison should ignore expected run identity fields: run ID, creation time, and copied input path.

## 2026-04-30: Run Contract Slice Added

Files changed:

- `src/contracts.ts`: added replay compatibility checks, run comparison utilities, and human-readable formatters.
- `schemas/run_config.schema.json`: added artifact contract metadata validation.
- `src/run-config.ts`: added artifact contract metadata and bumped harness version to `1.3.0`.
- `src/cli.ts`: added `crux replay --check <runDir>` and `crux diff <leftRunDir> <rightRunDir>`.
- `src/types.ts`: added artifact contract fields to `RunConfig`.
- `tests/contracts.test.ts`: added artifact contract, replay compatibility, prompt drift, stage drift, and CLI tests.
- `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`: documented and versioned the Phase 3 slice.

Backtrack note:

- `src/contracts.ts` is isolated from the pipeline.
- Removing CLI commands does not affect run generation.
- Artifact contract metadata is generated in `buildRunConfig`; revert there if schema expansion needs to be backed out.

Verification:

- `npm test`: 35/35 passing.
- `npm run benchmark`: 7/7 benchmark scenarios passing, 0 regressions.
- `npm run crux -- replay --check runs/latest`: replay compatibility pass, current harness `1.3.0`.
- `npm run crux -- inspect runs/latest`: integrity pass, harness version `1.3.0`.

Optimality checkpoint:

- This is the smallest useful Phase 3 slice because it gives users concrete replay and comparison tools without introducing storage, UI, or hosted replay complexity.
- I do not know how to make this slice better without adding premature artifact diff depth beyond the current contract-level comparison.
