# Changelog

## 1.2.0 - 2026-04-30

- Added formal stage module metadata for every current pipeline stage.
- Added deterministic stage registry plus LLM module metadata for claim decomposition and evidence mapping.
- Added `runStageModule` with timeout and retry execution.
- Extended `run_config.json` with selected stage modules.
- Added trace metadata for module ID, version, kind, prompt, provider, model, timeout, retries, attempts, and duration.
- Added stage runtime tests for registry defaults, LLM selection metadata, retries, and pipeline trace/run-config recording.

## 1.1.0 - 2026-04-30

- Added `crux sources import <inputDir> --out <sourcePackDir>` for converting raw Markdown, TXT, and CSV files into Crux source packs.
- Added deterministic source IDs and generated source-pack files with required metadata front matter.
- Added importer tests that validate generated source packs through existing source inventory and chunking logic.

## 1.0.0 - 2026-04-30

- Added `run_config.json` so runs lock harness version, input hash, source policy, mapper selection, budgets, and prompt versions.
- Added deterministic and optional LLM claim-decomposer selection.
- Added enhanced evaluator dimensions: `claim_graph_integrity`, `faithfulness`, and `crux_quality`.
- Added faithfulness checks that flag unsupported certainty and memo claims that do not map back to `claims.json`.
- Added stricter claim graph integrity checks for self-dependencies and dependency cycles.
- Generalized deterministic source-grounded evidence mapping across all source packs.
- Added curated local source packs for all seven benchmark scenarios.
- Raised benchmark expectations so every scenario requires source-backed evidence and verified excerpts.
- Added `crux inspect <run>` for compact run summaries.
- Added GitHub Actions CI for tests and benchmark regression gates.

## 0.4.0

- Added optional LLM evidence mapper with strict JSON parsing and provenance checks.

## 0.3.0

- Added source chunks and provenance verification for source-backed evidence.

## 0.2.0

- Added local source-pack ingestion and source inventory artifacts.

## 0.1.0

- Added deterministic Crux CLI harness, core artifacts, evaluator, replay, and benchmark scaffold.
