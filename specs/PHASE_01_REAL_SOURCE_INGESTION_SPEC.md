# Phase 1 Spec: Real Source Ingestion

Status: started. The first implementation slice supports deterministic import of Markdown, TXT, and CSV files into validated source packs.

## Purpose

Make Crux usable with real user material instead of hand-authored source packs only.

This phase converts folders of raw files into validated Crux source packs while preserving the v1 trust contract.

## Optimality Hypothesis

This is the best first post-v1 phase because real-world usefulness starts when users can bring messy source material into the harness without manually crafting source files.

I do not know how to make this phase better without widening scope into UI, live web research, or storage concerns too early.

## Scope

- Import raw `.md`, `.txt`, `.csv`, and simple URL snapshot files.
- Generate Crux-compatible source-pack files.
- Create metadata front matter when missing.
- Preserve content hashes.
- Support deterministic source IDs.
- Support deterministic filenames.
- Validate generated source inventory and chunks using existing validators.
- Add CLI command:

```bash
crux sources import <inputDir> --out <sourcePackDir>
```

## Non-Goals

- No live autonomous web research.
- No browser crawling.
- No PDF parsing in the first slice unless bundled tooling makes it trivial and testable.
- No database-backed storage.
- No UI drag-and-drop.

## Deliverables

- `src/source-importer.ts`
- CLI command group for `crux sources import`
- raw source fixtures under `tests/fixtures/raw-sources`
- tests for Markdown, TXT, CSV, and skipped unsupported files
- generated source-pack validation tests
- README section for source import

## TDD Plan

1. Add a failing test that imports a mixed raw-source fixture directory.
2. Assert generated source files contain required front matter.
3. Assert deterministic `S1`, `S2`, `S3` IDs.
4. Assert generated source pack can pass `buildSourceInventory`.
5. Assert generated chunks pass `buildSourceChunks`.
6. Assert unsupported files are skipped with a summary, not silently ignored.
7. Implement the smallest importer that passes the tests.

## Acceptance

- A user can provide a folder of real documents.
- Crux creates a valid source pack.
- Every generated source has traceable metadata.
- Chunks are stable and reproducible.
- Existing `npm test` passes.
- Existing `npm run benchmark` passes.

## Risks

- Auto-generated metadata may be too weak for real decisions.
- CSV chunking may need more structure later.
- Importing source material is easy to make too magical.

## Quality Bar

This phase is done only when the generated source pack is boring, deterministic, inspectable, and compatible with the existing artifact contracts.
