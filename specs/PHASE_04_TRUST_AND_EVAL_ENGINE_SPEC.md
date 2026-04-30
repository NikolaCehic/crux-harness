# Phase 4 Spec: Trust And Eval Engine

Status: started. First implementation slice adds the deterministic evaluator council to `eval_report.json`, including specialist reviewers, preserved disagreements, and synthesis blocking-failure output.

## Purpose

Make Crux diagnose whether an analysis run is trustworthy, not merely whether it produced valid files.

## Optimality Hypothesis

This is Crux's moat. Observability shows what happened; Crux must explain whether the reasoning is faithful, grounded, complete, and decision-useful.

The best design is an evaluator council: deterministic validators provide hard gates, while specialist evaluator agents review judgment-heavy dimensions and preserve disagreement instead of collapsing everything into one opaque score.

I do not know how to make this phase better without confusing eval quality with UI polish or letting model-judges bypass deterministic trust boundaries.

## Scope

- Stronger memo-to-claim faithfulness.
- Source quote verification.
- Claim-to-evidence coverage.
- Unsupported claim detection.
- Contradiction quality scoring.
- Uncertainty usefulness scoring.
- Red-team strength rubric.
- Hallucination and fabrication detection.
- Benchmark regression history.
- Failure diagnosis by stage.
- Evaluator council with specialist reviewer roles.
- Council disagreement report.
- Synthesis judge that summarizes pass/fail status, blocking failures, and next fixes.

## Evaluator Council

The council does not replace deterministic validators. It sits after hard validation and evaluates the reasoning quality of a run.

Hard deterministic gates:

- schema validity
- artifact completeness
- claim ID validity
- evidence ID validity
- source ID validity
- source chunk validity
- excerpt provenance
- claim graph cycles
- benchmark regressions

Specialist evaluator agents:

- Evidence Auditor: checks relevance, quote use, source quality, and missing source types.
- Claim Graph Auditor: checks whether claims are atomic, connected, and decision-relevant.
- Faithfulness Auditor: checks whether the memo adds unsupported conclusions or overstates evidence.
- Red Team: builds the strongest opposing case and checks whether it could change the recommendation.
- Uncertainty Auditor: checks whether uncertainties are specific, high-impact, and linked to tests.
- Decision Utility Auditor: checks whether a serious user could act on the output.
- Domain Reviewer: applies vertical-pack-specific risks, traps, and source expectations when a pack is present.
- Synthesis Judge: compares evaluator findings, preserves disagreement, identifies blocking failures, and recommends the next fixes.

The red team remains a specialist inside the council; it is not removed or diluted.

## Non-Goals

- No full human annotation product.
- No hosted eval dashboard.
- No replacement for expert judgment.
- No opaque single aggregate score as the only output.

## Deliverables

- evaluator modules by dimension
- stage-level failure diagnosis
- council evaluator modules
- council disagreement report
- synthesis judge output
- richer `eval_report.json`
- benchmark trend report
- failure fixtures for unsupported memo claims
- failure fixtures for weak red-team output
- failure fixtures for missing evidence coverage

## TDD Plan

1. Add fixtures with fabricated memo claims.
2. Add fixtures with missing evidence coverage.
3. Add fixtures with weak red-team sections.
4. Add fixtures with vague uncertainty.
5. Add tests for stage-level diagnosis labels.
6. Add tests for council disagreement preservation.
7. Add tests for synthesis judge blocking-failure output.
8. Implement deterministic validators first.
9. Implement specialist evaluator modules.
10. Implement synthesis judge only after individual evaluator outputs are preserved.

## Acceptance

- Crux detects unsupported memo conclusions.
- Crux detects weak or missing evidence coverage.
- Crux detects shallow red-team output.
- Crux detects vague uncertainty.
- Crux identifies whether a failure came from ingestion, claims, evidence, memo writing, or evaluation.
- Red team exists as a council role.
- Council output preserves specialist disagreement.
- Synthesis judge summarizes blocking failures without hiding underlying evaluator findings.
- Benchmark reports show useful quality changes over time.
- `npm test` and `npm run benchmark` pass.

## Risks

- Heuristic evals can become brittle.
- LLM-as-judge evals can hide their own unreliability.
- Too many eval dimensions can overwhelm users.
- Council consensus can hide important minority objections.
- Specialist agents can produce persuasive but ungrounded critiques if not constrained by artifacts.

## Quality Bar

The eval engine must help users fix runs, not merely score them. Deterministic validators remain the trust boundary; the council adds judgment, disagreement, and diagnosis.
