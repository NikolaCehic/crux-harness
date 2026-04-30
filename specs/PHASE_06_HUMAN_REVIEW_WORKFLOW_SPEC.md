# Phase 6 Spec: Human Review Workflow

Status: started. First implementation slice adds schema-validated `review.json`, claim review actions, evidence annotations, trace events, and reviewed memo export.

## Purpose

Make human review a structured part of Crux rather than leaving corrections in ad hoc comments or external documents.

## Optimality Hypothesis

Serious analysis workflows require human judgment. Crux should preserve that judgment as structured, traceable review data.

I do not know how to make this phase better without adding team permissions and deployment too early.

## Scope

- Approve or reject claims.
- Annotate evidence.
- Edit source mappings.
- Mark claims as unsupported.
- Request reruns for individual stages.
- Maintain review history.
- Export reviewed memo.

## Non-Goals

- No multi-user permission model.
- No hosted review queues.
- No marketplace pack review.
- No legal approval workflow.

## Deliverables

- `review.json`
- review artifact schema
- review commands
- reviewed memo export
- review-aware eval report
- UI review controls if Phase 5 exists
- tests for review persistence and traceability

## TDD Plan

1. Add schema tests for `review.json`.
2. Add tests for approving and rejecting claims.
3. Add tests for evidence annotations.
4. Add tests for reviewed memo export.
5. Add tests proving review actions appear in trace.
6. Implement review commands and artifact updates.

## Acceptance

- A reviewer can correct a run without rerunning everything.
- Review actions are traceable.
- Final exports distinguish machine output from human-approved output.
- Eval reports can account for human corrections.
- `npm test` and `npm run benchmark` pass.

## Risks

- Review data can conflict with source artifacts.
- Human edits can weaken reproducibility if not tracked.
- Partial reruns can create stale dependencies.

## Quality Bar

Human review must improve accountability without corrupting the original run record.
