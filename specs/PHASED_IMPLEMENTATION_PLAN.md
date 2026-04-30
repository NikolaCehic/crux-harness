# Phased Implementation Plan

This plan is the current converged build sequence for Crux. Each phase is intentionally scoped so it creates the strongest foundation for the next phase without widening the blast radius too early.

Each implementation phase must follow test-driven development:

1. Write failing tests that describe the behavior.
2. Implement the smallest coherent change that makes the tests pass.
3. Run `npm test` and `npm run benchmark`.
4. Update specs, benchmark expectations, and baselines only when the quality bar intentionally changes.
5. Commit only when the phase satisfies: "I do not know how to make this better within the phase scope."

## Phase 1: v0.3 Evidence Mapper And Provenance Verifier

Status: implemented.

Optimality hypothesis: This is the best next phase because Crux already has source packs, but it still needs a hard boundary between source ingestion, evidence mapping, and provenance verification. Before adding LLM intelligence, Crux must prove that evidence excerpts genuinely come from cited source text.

Scope:

- Add source chunking with stable chunk IDs.
- Add `source_chunks.json`.
- Add an evidence mapper interface.
- Move current source-backed strategic-tech evidence mapping out of generic artifact generation.
- Add provenance verification for:
  - valid source IDs
  - valid chunk IDs
  - excerpt text present in cited chunk text
  - no placeholder evidence in source-grounded mode
  - valid claim IDs
- Add benchmark/report provenance stats.

Non-goals:

- No LLM provider yet.
- No web research.
- No memo generation changes beyond provenance-aware reporting.
- No UI.

Acceptance:

- `npm test` passes.
- `npm run benchmark` passes.
- Strategic-tech produces source-backed evidence with verified `chunk_ids`.
- Corrupted excerpts fail integrity validation.

## Phase 2: v0.4 Optional LLM Evidence Mapper

Optimality hypothesis: This is the best first LLM phase because the LLM receives one bounded task and every output is checked by schema validation and provenance verification.

Scope:

- Add provider-neutral LLM interface.
- Add environment configuration for provider, model, and API key.
- Add `prompts/evidence-mapper.md`.
- Add strict JSON parsing and retry policy.
- Validate LLM output against schemas and provenance checks.
- Keep deterministic mapper as default and fallback.
- Add mocked LLM tests.

Acceptance:

- Tests pass without API keys.
- Manual LLM mode can generate strategic-tech evidence.
- Invalid LLM evidence is rejected.

## Phase 3: v0.5 Claim Decomposer

Optimality hypothesis: Claim generation should come after evidence mapping because generated claims without grounded evidence would increase fluency before trustworthiness.

Scope:

- Add deterministic claim decomposer fallback.
- Add optional LLM claim decomposer.
- Validate atomicity, claim types, root claims, and dependencies.
- Add graph integrity checks for orphan roots and missing dependencies.
- Run first on strategic-tech.

Acceptance:

- Strategic-tech claims can be generated and evidence-mapped.
- Benchmark remains green.
- Invalid claim graphs fail loudly.

## Phase 4: v0.6 Faithfulness Evaluator

Optimality hypothesis: Once claims and evidence are generated, the next highest-risk surface is the final memo inventing unsupported conclusions.

Scope:

- Add memo-to-claim checker.
- Add memo-to-evidence checker.
- Add unsupported memo-claim findings.
- Add `faithfulness` score to `eval_report.json`.
- Add failure fixtures for fabricated memo statements.

Acceptance:

- Memo cannot introduce unsupported conclusions silently.
- Benchmark protects the new faithfulness baseline.

## Phase 5: v0.7 Source Packs For All Benchmarks

Optimality hypothesis: Broadening source-grounded mode should happen only after the source mapper and verifier are proven on one benchmark.

Scope:

- Add source packs for all remaining benchmark scenarios.
- Raise source-quality baselines scenario by scenario.
- Require source-backed evidence for all benchmark scenarios.
- Remove placeholder evidence from benchmark-critical paths.

Acceptance:

- All seven benchmark scenarios use source packs.
- All have verified source-backed evidence.
- Benchmark protects scenario-specific source-quality baselines.

## Phase 6: v0.8 Replayable Web Research Mode

Optimality hypothesis: Live research should come only after local source packs prove provenance and replay semantics.

Scope:

- Add `source_policy: web`.
- Add web search/fetch adapter.
- Save fetched source snapshots locally.
- Convert fetched snapshots into source inventory entries.
- Record retrieval timestamps and URLs.
- Ensure replay uses saved snapshots.

Acceptance:

- Web mode creates reproducible local source packs.
- Replay does not depend on the internet.
- Provenance checks still pass.

## Phase 7: v0.9 Decision Quality Evals

Optimality hypothesis: Quality evals become most valuable once artifacts are generated from real sources and can be judged beyond structure.

Scope:

- Add crux-detection score.
- Add red-team strength rubric.
- Add uncertainty usefulness rubric.
- Add "what would change my mind" evaluator.
- Add scenario-specific known traps.
- Add benchmark trend comparison.

Acceptance:

- Benchmark catches shallow but schema-valid analysis.
- Reports show quality dimensions that improved or regressed.

## Phase 8: v1.0 Product-Grade Harness

Optimality hypothesis: Packaging comes after the core reasoning loop is real enough to be worth stabilizing for outside users.

Scope:

- Stabilize CLI commands and docs.
- Add run config locking.
- Add prompt/version metadata.
- Add changelog.
- Add CI workflow.
- Add release checklist.
- Add examples for each scenario.
- Add `crux inspect <run>` summary command.

Acceptance:

- A new user can clone, install, run, benchmark, and inspect Crux without guidance.
- CI protects tests and benchmark regressions.
