# MVP Build Plan

## Goal

Build Crux v0.1 as a local CLI harness that can execute one full analysis pipeline and produce valid artifacts.

## Milestone 0: Spec Pack

Status: started.

Deliverables:

- `README.md`
- `specs/PRODUCT_SPEC.md`
- `specs/ARTIFACT_SPEC.md`
- `specs/RUN_SPEC.md`
- `specs/EVAL_SPEC.md`
- initial schemas
- one example input

Definition of done:

- specs are coherent
- artifact names match across specs
- schemas cover core structured artifacts

## Milestone 1: Skeleton CLI

Deliverables:

- Python package or TypeScript package
- `crux run <input>`
- `crux eval <run_dir>`
- `crux replay <run_dir>`
- run folder creation
- trace logging

Recommended implementation:

- Python for fast schema validation, file IO, and agent orchestration
- `pydantic` for internal models
- JSON Schema files for external contracts
- `typer` for CLI
- `pytest` for tests

## Milestone 2: Deterministic Stub Pipeline

Deliverables:

- every stage implemented with deterministic stub logic
- all required artifacts generated
- schema validation passes
- eval report generated

Purpose:

Prove the harness contract before adding model intelligence.

## Milestone 3: LLM-Assisted Pipeline

Deliverables:

- decomposer agent
- claim extractor
- evidence mapper with curated/offline sources
- verifier
- red team
- uncertainty modeler
- memo writer
- evaluator

Purpose:

Turn the harness from a shell into a useful analysis system.

## Milestone 2.5: Source-Grounded Evidence Mode

Status: implemented for the strategic technology benchmark.

Deliverables:

- `source_pack` support in input YAML
- local source inventory generation
- `source_inventory.json` schema
- source-backed evidence items
- provenance integrity checks
- benchmark gates against placeholder evidence

Purpose:

Make Crux unable to fake evidence before adding LLM-powered evidence mapping.

## Milestone 2.6: Evidence Mapper And Provenance Verifier

Status: implemented for the strategic technology benchmark.

Deliverables:

- source chunking
- `source_chunks.json` schema
- evidence mapper boundary
- stable `chunk_ids`
- verified evidence excerpts
- corruption tests for forged excerpts

Purpose:

Make Crux prove that source-backed evidence came from cited source text.

## Milestone 3: Optional LLM Evidence Mapper

Status: implemented as an opt-in mode.

Deliverables:

- provider-neutral LLM client interface
- evidence mapper prompt
- strict JSON output parsing
- deterministic fallback
- trace metadata for mapper selection
- mocked LLM tests

Purpose:

Allow model-assisted evidence mapping without letting model output bypass schemas or provenance checks.

## Milestone 4: Web Research Mode

Deliverables:

- source policy enforcement
- web search adapter
- source capture and citation format
- source relevance scoring
- evidence deduplication

Purpose:

Enable live analysis while preserving auditability.

## Milestone 5: Golden Tests

Deliverables:

- 10 benchmark inputs
- expected evaluation notes
- regression test runner
- score comparison across runs

Purpose:

Make progress measurable.

## Recommended First Vertical Slice

Input:

```text
Should a frontier AI startup build an enterprise agent platform in 2026?
```

Output:

- valid question spec
- at least 12 claims
- at least 8 evidence items
- at least 3 contradictions or gaps
- strong red-team memo
- uncertainty model with at least 5 key uncertainties
- decision memo with recommendation and next tests
- eval report

## Build Order

1. Create package skeleton.
2. Implement schemas and validators.
3. Implement run directory and trace logging.
4. Implement deterministic stub stages.
5. Add tests for all artifacts.
6. Add LLM calls stage by stage.
7. Add research tools last.

## Design Rule

No stage may directly jump to the final answer.

Every conclusion must pass through structured artifacts first.
