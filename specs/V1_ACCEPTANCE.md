# Crux v1 Acceptance

Crux v1 is the first product-grade local harness release.

## Optimality Hypothesis

This v1 scope is the most optimal release boundary because it stabilizes the full auditable loop before adding live external research or broad provider-specific behavior. The harness now proves that structured artifacts, local source grounding, provenance verification, evaluation, replay, inspection, and CI all work together.

## Required Capabilities

- A new user can install dependencies with `npm install`.
- A user can run an example with `npm run crux -- run examples/frontier-agent-platform.yaml`.
- Every run writes `run_config.json`.
- Every run writes the full artifact set required by the artifact spec.
- All benchmark scenarios use local source packs.
- All benchmark scenarios forbid placeholder evidence.
- All benchmark scenarios require verified source excerpts.
- The evaluator scores schema validity, claim graph integrity, claim coverage, evidence traceability, source quality, contradiction handling, red-team strength, uncertainty quality, faithfulness, crux quality, and decision usefulness.
- `crux inspect <run>` gives a compact summary of a run.
- CI runs tests and benchmark gates.

## Non-Goals

- Live web search is not part of v1.
- Provider-specific prompt optimization is not part of v1.
- A web UI is not part of v1.
- Crux v1 is not a source of final authority; it is a harness for auditable reasoning artifacts.
