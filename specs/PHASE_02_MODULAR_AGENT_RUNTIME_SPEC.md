# Phase 2 Spec: Modular Agent Runtime

## Purpose

Turn Crux stages into replaceable modules so deterministic and model-backed implementations can coexist behind the same artifact contracts.

## Optimality Hypothesis

This phase should follow real ingestion because model-backed agents are only valuable when they operate over real sources and remain constrained by schemas, provenance, and evals.

I do not know how to make this phase better without prematurely committing to one agent framework or provider.

## Scope

- Define a formal stage module interface.
- Make each major stage replaceable.
- Keep deterministic implementations as defaults.
- Support optional LLM-backed implementations.
- Add stage-level timeout, retry, and budget controls.
- Record module version, prompt version, model, and provider in traces.
- Preserve existing artifact names and schemas.

## Stage Modules

- question normalizer
- claim decomposer
- source researcher
- evidence mapper
- contradiction finder
- red-team agent
- uncertainty modeler
- memo writer
- evaluator

## Non-Goals

- No hosted runtime.
- No UI.
- No marketplace.
- No hard dependency on LangGraph, OpenAI Agents SDK, or any single agent framework.

## Deliverables

- `src/stages/types.ts`
- module registry
- deterministic module adapters
- LLM module adapter shape
- module selection in `run_config.json`
- tests for module selection and fallback behavior
- tests for failed module output rejection

## TDD Plan

1. Add tests for the stage module interface.
2. Add tests proving deterministic modules remain default.
3. Add tests proving configured LLM modules are selected only when fully configured.
4. Add tests proving invalid module output fails before artifact write.
5. Add tests proving trace metadata includes module identity.
6. Implement module registry and adapters.

## Acceptance

- Every stage can run deterministically.
- Selected stages can run through LLM-backed modules.
- Failed model output cannot bypass schemas.
- Every module records version, prompt, model, budget, and trace metadata.
- `npm test` and `npm run benchmark` pass.

## Risks

- The module interface can become too abstract too early.
- Different stages may need different failure semantics.
- Bad fallback behavior could hide model failures.

## Quality Bar

The module system must make stages easier to replace without weakening Crux's audit trail.
