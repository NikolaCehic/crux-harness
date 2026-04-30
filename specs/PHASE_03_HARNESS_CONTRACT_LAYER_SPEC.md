# Phase 3 Spec: Harness Contract Layer

Status: started. The first implementation slice adds artifact contract metadata, replay compatibility checks, run comparison utilities, and CLI commands for replay checks and diffs.

## Purpose

Strengthen Crux run contracts so prompt, model, source, tool, and artifact changes can be replayed, compared, and explained.

## Optimality Hypothesis

Once stages are modular, Crux needs stronger contracts so users can trust comparisons across module, model, prompt, and source changes.

I do not know how to improve this phase without turning it into deployment infrastructure too soon.

## Scope

- Artifact versioning.
- Stage versioning.
- Prompt version locking.
- Model config locking.
- Source policy locking.
- Tool permission locking.
- Budget enforcement.
- Replay policy enforcement.
- Run diffing primitives.

## Non-Goals

- No multi-user storage.
- No hosted replay service.
- No visual run comparison yet.
- No marketplace compatibility system yet.

## Deliverables

- expanded `run_config.json`
- artifact version metadata
- stage contract metadata
- run comparison utility
- replay compatibility checker
- tests for config drift detection
- tests for artifact diff summaries

## TDD Plan

1. Add tests for artifact version fields.
2. Add tests for replay compatibility checks.
3. Add tests for detecting changed prompt versions.
4. Add tests for detecting changed model configs.
5. Add tests for run diff summaries.
6. Implement contract metadata and diff utilities.

## Acceptance

- Any run can be replayed from locked config.
- Two runs can be compared artifact by artifact.
- Prompt, model, source, and module changes are visible.
- Crux can explain why two runs are not directly comparable.
- `npm test` and `npm run benchmark` pass.

## Risks

- Too much metadata can reduce usability.
- Diffing can become noisy.
- Replay guarantees must be honest around nondeterministic model calls.

## Quality Bar

The contract layer should make Crux more trustworthy without making simple local runs feel heavy.
