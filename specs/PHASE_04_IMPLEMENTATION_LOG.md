# Phase 4 Implementation Log: Trust And Eval Engine

This log records implementation decisions and file-level changes for Phase 4 so the work can be backtracked safely.

## 2026-04-30: Start Evaluator Council Slice

Goal:

- Add a structured evaluator council to `eval_report.json`.
- Preserve specialist reviewer outputs instead of collapsing trust into one aggregate score.
- Keep deterministic validators as the hard trust boundary.
- Add a synthesis judge that reports pass/warn/fail status, blocking failures, and next fixes.
- Preserve council disagreements when one reviewer fails and another passes.

Planned files:

- `src/eval-council.ts`: deterministic council reviewer module and synthesis judge.
- `src/evaluator.ts`: integrate council generation into `evaluateRun`.
- `src/types.ts`: add council report, reviewer, disagreement, and status types.
- `schemas/eval_report.schema.json`: validate council output.
- `tests/eval-council.test.ts`: council role completeness, faithfulness blocking failures, and red-team disagreement tests.
- `src/inspect.ts`: surface council status in run summaries.
- `README.md`, `CHANGELOG.md`, `specs/ARTIFACT_SPEC.md`, `specs/EVAL_SPEC.md`, `specs/V1_ACCEPTANCE.md`, `specs/RELEASE_CHECKLIST.md`, `package.json`, `package-lock.json`: document and version the slice.

Backtrack note:

- `src/eval-council.ts` is isolated from artifact generation and stage execution.
- Reverting the council requires removing the `council` field from `EvalReport`, `eval_report.schema.json`, and `evaluateRun`.
- Existing top-level scores are preserved for benchmark compatibility.

## 2026-04-30: Evaluator Council Added

Files changed:

- `src/eval-council.ts`: added evidence, claim graph, faithfulness, red-team, uncertainty, decision utility, domain, and synthesis reviewers.
- `src/evaluator.ts`: includes council output in every eval report.
- `src/types.ts`: added typed council status, reviewer, disagreement, and synthesis contracts.
- `schemas/eval_report.schema.json`: made council output schema-valid and required.
- `src/artifacts.ts`: updated initial eval-report scaffold to include council output.
- `src/inspect.ts`: added council status and reviewer lines to inspect summaries.
- `tests/eval-council.test.ts`: added TDD coverage for role completeness, faithfulness blocking failures, and weak red-team disagreement preservation.
- `README.md`, `CHANGELOG.md`, `specs/ARTIFACT_SPEC.md`, `specs/EVAL_SPEC.md`, `specs/V1_ACCEPTANCE.md`, `specs/RELEASE_CHECKLIST.md`, `package.json`, `package-lock.json`: documented and versioned the Phase 4 slice.

Verification:

- `npm test`: 38/38 passing.
- `npm run benchmark`: 7/7 benchmark scenarios passing, 0 regressions.
- `npm run crux -- inspect runs/latest`: integrity pass, harness version `1.4.0`, council pass with synthesis confidence `0.99`.

Optimality checkpoint:

- This is the most useful first Phase 4 slice because it makes trust diagnosis machine-readable and inspectable without adding model-judge opacity or a UI dependency.
- I do not know how to make this slice better without prematurely expanding into hosted eval dashboards, human annotation workflows, or LLM evaluators before the deterministic council contract is stable.
