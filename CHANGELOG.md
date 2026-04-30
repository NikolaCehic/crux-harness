# Changelog

## Unreleased

- Added extended E2E expectation checks for required artifacts, evaluator council roles, diagnostics, trace stages, static report anchors, expected failure diagnostics, and human review summaries.
- Added nested E2E suites for benchmark DSL coverage, black-box CLI product journeys, and adversarial broken-run fixtures.
- Added `test:e2e`, `test:journeys`, `test:adversarial`, and `release:verify` scripts.
- Added E2E strategy and Phase 11 implementation docs.

## 1.10.0 - 2026-04-30

- Added local marketplace manifest schema and registry.
- Added marketplace compatibility verification for harness major and artifact versions.
- Added local pack installation into a target packs directory.
- Added `crux marketplace list`, `crux marketplace verify`, and `crux marketplace install`.
- Added tests for manifest validation, compatibility failures, local install, and CLI behavior.

## 1.9.0 - 2026-04-30

- Added Dockerfile, `.dockerignore`, and `docker-compose.yml` for self-hosted local API deployment.
- Added deployment docs for running the API, health checks, secrets, and state volumes.
- Added secret-safe deployment config reporting for API and model provider settings.
- Added tests for deployment config, Docker command shape, compose environment, and ignored local state.

## 1.8.0 - 2026-04-30

- Added a dependency-free local HTTP API server.
- Added `POST /runs`, `GET /runs/{runId}/eval`, and `GET /runs/{runId}/artifacts/{artifactName}`.
- Added `CruxLocalSdk` for creating runs and reading artifacts without shelling into the CLI.
- Added tests for API run creation, eval fetching, artifact fetching, path traversal rejection, and SDK behavior.

## 1.7.0 - 2026-04-30

- Added `pack.json` schema validation for vertical agent packs.
- Added seven initial pack manifests for investment diligence, market entry, policy analysis, product strategy, root-cause analysis, scientific thesis evaluation, and strategic technology.
- Added pack loader, discovery, custom-scope fallback, and `crux packs list` / `crux packs inspect`.
- Added tests for valid packs, invalid manifests, pack discovery, and custom scopes.

## 1.6.0 - 2026-04-30

- Added `review.json` as a schema-validated human review sidecar artifact.
- Added review commands for initializing review state, approving or rejecting claims, annotating evidence, and exporting reviewed memos.
- Added trace events for review actions so human corrections remain auditable.
- Added reviewed memo export that separates human review summary from the machine-generated memo.

## 1.5.0 - 2026-04-30

- Added a run artifact bundle loader for visual inspection surfaces.
- Added `crux report <runDir> --out <file>` to write a static HTML run inspector.
- Added a linked report view for memo, claims, evidence, source excerpts, contradictions, uncertainty, eval council, diagnostics, and trace events.
- Added tests for bundle relationships, report anchors, and compiled CLI report generation.

## 1.4.1 - 2026-04-30

- Added structured eval diagnostics with stage, severity, category, message, and recommended fix fields.
- Added diagnostics for missing claim evidence, vague uncertainty, weak red-team output, and memo faithfulness failures.
- Updated uncertainty quality scoring to detect vague placeholder language without regressing healthy benchmark runs.
- Added inspect output for diagnostics when a run has actionable eval failures.

## 1.4.0 - 2026-04-30

- Added a deterministic evaluator council to `eval_report.json`.
- Added specialist reviewer outputs for evidence, claim graph quality, faithfulness, red-team strength, uncertainty, decision utility, domain fit, and synthesis.
- Added council disagreement preservation and synthesis blocking-failure reporting.
- Added council schema validation, tests for weak red-team disagreement, and inspect output for council status.

## 1.3.0 - 2026-04-30

- Added artifact contract metadata to `run_config.json`.
- Added replay compatibility checks with copied input hash verification.
- Added run comparison utilities that ignore run identity fields but detect prompt, source, budget, mapper, stage, and artifact-contract drift.
- Added `crux replay --check <runDir>`.
- Added `crux diff <leftRunDir> <rightRunDir>`.

## 1.2.1 - 2026-04-30

- Added typed executable stage adapters for all current pipeline stages.
- Refactored the pipeline to execute adapters through the stage runtime instead of passing inline closures.
- Added adapter tests proving deterministic source-grounded claims and evidence can be produced through the adapter layer.

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
