# Phase 7 Spec: Vertical Agent Packs

## Purpose

Turn the generic Crux harness into immediately useful specialized analysis agents.

Vertical packs are accelerators, not limits.

## Optimality Hypothesis

Vertical packs are the best marketability layer because they add domain-specific quality without compromising the generic core harness.

I do not know how to make this phase better without hard-coding domains into the core.

## Scope

- Investment diligence pack.
- Market-entry pack.
- Product strategy pack.
- Policy analysis pack.
- Root-cause analysis pack.
- Technical thesis pack.
- Pack manifest format.
- Pack-specific templates and eval rubrics.
- Pack-specific benchmarks.

## Pack Contents

Each pack includes:

- input template
- source requirements
- claim taxonomy
- expected evidence types
- known failure modes
- eval rubric
- memo format
- benchmark scenarios

## Non-Goals

- No marketplace yet.
- No paid pack distribution.
- No domain-specific logic in core harness.
- No requirement that every run uses a pack.

## Deliverables

- `packs/<pack-name>/pack.json`
- pack loader
- pack validation
- pack-specific benchmark expectations
- generic custom pack example
- documentation for creating a pack

## TDD Plan

1. Add tests for loading a valid pack manifest.
2. Add tests for rejecting invalid pack manifests.
3. Add tests for applying pack templates.
4. Add tests for pack-specific eval thresholds.
5. Add tests proving `analysis_scope: custom` still works without a pack.
6. Implement pack loader and validators.

## Acceptance

- Generic custom runs still work.
- Vertical runs produce stronger domain-specific artifacts.
- Vertical benchmarks protect pack quality.
- Users can create new packs without changing core harness code.
- `npm test` and `npm run benchmark` pass.

## Risks

- Packs can become disguised hard-coded application logic.
- Pack schemas can become too complex.
- Poor packs can reduce trust in Crux.

## Quality Bar

Packs must make Crux more useful while keeping the core harness domain-independent.
