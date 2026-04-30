# Phase 5 Spec: Visual Run Inspector

## Purpose

Give users a product surface for inspecting Crux runs without opening JSON files.

## Optimality Hypothesis

The UI becomes valuable only after the underlying artifacts are real. At this point, Crux needs a visual inspection layer for non-engineers.

I do not know how to make this phase better without turning it into a full team product too early.

## Scope

- Web UI.
- Run list.
- Run summary.
- Claim graph view.
- Evidence table.
- Source excerpt viewer.
- Contradiction panel.
- Uncertainty dashboard.
- Trace timeline.
- Eval report view.
- Run comparison view.

## Non-Goals

- No multi-user auth.
- No hosted deployment.
- No collaborative review workflow.
- No marketplace.

## Deliverables

- local web app
- API route or static loader for run artifacts
- run summary page
- claim graph component
- evidence-source drilldown
- eval report view
- Playwright checks for key views

## TDD Plan

1. Add tests for loading a run artifact bundle.
2. Add component tests for run summary data.
3. Add browser test for opening `runs/latest`.
4. Add browser test for evidence drilldown.
5. Add browser test for eval report visibility.
6. Implement UI iteratively against existing run fixtures.

## Acceptance

- A non-engineer can inspect a run without reading JSON.
- Users can move from memo to claim to evidence to source excerpt.
- Users can see what failed and why.
- UI works on a local run produced by `npm run crux -- run`.
- `npm test` and `npm run benchmark` pass.

## Risks

- UI can hide artifact details behind polish.
- Graph views can become decorative instead of useful.
- The product can drift away from CLI reproducibility.

## Quality Bar

The UI must make the reasoning trail clearer, not merely prettier.
