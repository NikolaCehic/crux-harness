# Phase 14 Source-Pack Productization Log

## 2026-05-02T18:47:00+02:00

Intent:

- Make arbitrary-query runs source-backed when a caller supplies a source pack.
- Support Crux Studio's local product bridge without adding hosted infrastructure.

Implemented:

- Added `sourcePack` to arbitrary-query run options.
- Preserved `source_pack` in generated run inputs and `query_intake.json`.
- Added `--source-pack <dir>` to `crux query` and `crux ask`.
- Added source and source-chunk counts to CLI query summaries.
- Added regression tests for generated source-pack inputs and compiled CLI source-pack runs.

Verification:

- `npm run build && node --test dist/tests/query-intake.test.js` passed.
- `npm test` passed with 76 tests.

Result:

- A user can now ask an arbitrary question and attach an existing source pack in one command, producing audited source inventory and chunk artifacts.
