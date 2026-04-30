# Release Checklist

Use this checklist before tagging a Crux release.

## Required Gates

- `npm ci`
- `npm test`
- `npm run benchmark`
- `npm run crux -- run examples/frontier-agent-platform.yaml`
- `npm run crux -- inspect runs/latest`
- `npm run crux -- report runs/latest --out test-results/run-report.html`
- `npm run crux -- review init runs/latest`
- `npm run crux -- packs list`
- API tests pass through `npm test`.
- Deployment manifest tests pass through `npm test`.
- Verify `runs/latest/run_config.json` has the intended harness version.
- Verify benchmark report has `7/7` scenarios passing and `0` regressions.

## Artifact Contract

- `run_config.json` is present and schema-valid.
- `source_inventory.json` and `source_chunks.json` are present for every run.
- Source-pack runs contain no placeholder evidence.
- Every non-calculation source-backed evidence item has `source_ids`, `chunk_ids`, and an excerpt verified against `source_chunks.json`.
- `eval_report.json` includes `claim_graph_integrity`, `faithfulness`, and `crux_quality`.
- `eval_report.json` includes council reviewers, preserved disagreements, and synthesis status.
- `eval_report.json` includes structured diagnostics for actionable stage-level failures.

## Documentation

- README version notes match the released behavior.
- `CHANGELOG.md` has the release entry.
- Benchmark baselines are updated only when the quality contract intentionally changes.

## Release Hypothesis

The release is acceptable only when the maintainer does not know a better scoped improvement that should block this release.
