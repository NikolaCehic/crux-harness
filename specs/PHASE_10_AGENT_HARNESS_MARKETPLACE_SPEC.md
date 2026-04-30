# Phase 10 Spec: Agent Harness Marketplace

## Purpose

Allow users and teams to compose Crux from reusable modules, vertical packs, evaluator packs, prompt packs, and benchmark suites.

## Optimality Hypothesis

A marketplace should come last because reusable modules only matter after the harness has durable contracts and real usage.

I do not know how to make this phase better without introducing ecosystem complexity before there is enough demand.

## Scope

- Reusable stage modules.
- Vertical packs.
- Evaluator packs.
- Source-ingestion plugins.
- Prompt packs.
- Benchmark suites.
- Certified harness templates.
- Pack compatibility checks.
- Pack quality benchmarks.

## Non-Goals

- No public paid marketplace in the first slice.
- No arbitrary remote code execution.
- No unverified pack execution in trusted runs.
- No weakening artifact contracts for pack convenience.

## Deliverables

- marketplace manifest schema
- local pack registry
- compatibility resolver
- pack install command
- pack verification command
- certification checklist
- example certified template

## TDD Plan

1. Add tests for marketplace manifest validation.
2. Add tests for compatibility resolution.
3. Add tests for rejecting incompatible artifact versions.
4. Add tests for installing a local pack.
5. Add tests for pack verification.
6. Add tests proving uncertified packs are marked clearly.
7. Implement registry and verification flow.

## Acceptance

- Users can install and compose packs.
- Packs declare compatibility with artifact versions.
- Pack quality is benchmarked.
- The ecosystem extends Crux without weakening core contracts.
- `npm test` and `npm run benchmark` pass.

## Risks

- Marketplace security is hard.
- Pack quality can vary widely.
- Compatibility resolution can become complex.

## Quality Bar

The marketplace must make Crux extensible while keeping trust, provenance, and eval quality central.
