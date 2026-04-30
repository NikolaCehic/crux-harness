# Artifact Spec

## Purpose

Every Crux run produces structured artifacts. These artifacts are the product.

The final memo is only one view over the underlying reasoning state.

## Run Folder

Each run writes to:

```text
runs/<run_id>/
```

Required files:

```text
input.yaml
question_spec.json
source_inventory.json
source_chunks.json
claims.json
evidence.json
contradictions.json
red_team.md
uncertainty.json
decision_memo.md
eval_report.json
trace.jsonl
```

## input.yaml

The user-authored input file.

Required fields:

- `question`
- `decision_context`
- `time_horizon`
- `output_goal`

Optional fields:

- `geography`
- `risk_tolerance`
- `known_constraints`
- `source_policy`
- `source_pack`
- `tool_budget`
- `model_budget`
- `user_prior`

## question_spec.json

Normalized decision framing.

Required fields:

- `question`
- `decision_type`
- `decision_owner`
- `context`
- `time_horizon`
- `success_criteria`
- `constraints`
- `unknowns`
- `required_artifacts`

## source_inventory.json

Local source-pack inventory.

Required fields:

- `source_pack`
- `sources`

Each source includes:

- `id`
- `path`
- `title`
- `source_type`
- `citation`
- `url`
- `published`
- `summary`
- `reliability`
- `recency`
- `relevance`
- `tags`
- `content_hash`

## source_chunks.json

Stable text chunks derived from source-pack files.

Required fields:

- `source_pack`
- `chunks`

Each chunk includes:

- `id`
- `source_id`
- `path`
- `ordinal`
- `text`
- `content_hash`

Chunk IDs use the format:

```text
S1#chunk-001
```

## claims.json

The claim graph.

Required top-level fields:

- `claims`
- `edges`
- `root_claim_ids`

Each claim includes:

- `id`
- `text`
- `type`
- `status`
- `importance`
- `confidence`
- `depends_on`
- `evidence_ids`
- `counterevidence_ids`
- `notes`

Allowed claim types:

- `descriptive`
- `causal`
- `predictive`
- `comparative`
- `normative`
- `decision`

Allowed claim statuses:

- `supported`
- `weakly_supported`
- `contested`
- `unsupported`
- `unknown`

## evidence.json

Evidence mapped to claims.

Required top-level fields:

- `evidence`

Each evidence item includes:

- `id`
- `source_type`
- `citation`
- `summary`
- `supports_claim_ids`
- `challenges_claim_ids`
- `reliability`
- `recency`
- `relevance`
- `limitations`

Optional source-grounding fields:

- `source_ids`
- `chunk_ids`
- `excerpt`

In source-grounded mode, every non-calculation evidence item must include at least one `source_id`, at least one `chunk_id`, and an `excerpt` that appears in the cited source chunk text.

Allowed source types:

- `web`
- `paper`
- `dataset`
- `internal_document`
- `calculation`
- `expert_input`
- `model_output`

## contradictions.json

Conflicts, weak points, and unresolved tensions.

Required fields:

- `contradictions`
- `unsupported_critical_claims`
- `missing_evidence`

Each contradiction includes:

- `id`
- `claim_ids`
- `description`
- `severity`
- `resolution_status`
- `next_step`

## red_team.md

The strongest case against the emerging recommendation.

Required sections:

- `## Opposing Thesis`
- `## Strongest Counterarguments`
- `## Failure Modes`
- `## Missing Evidence`
- `## Recommendation Impact`

## uncertainty.json

Uncertainty and sensitivity model.

Required fields:

- `overall_confidence`
- `key_uncertainties`
- `sensitivity`
- `what_would_change_my_mind`
- `recommended_tests`

Each key uncertainty includes:

- `id`
- `description`
- `current_estimate`
- `confidence`
- `impact_if_wrong`
- `evidence_needed`

## decision_memo.md

Human-readable final synthesis.

Required sections:

- `## Recommendation`
- `## Executive Summary`
- `## Core Reasoning`
- `## Key Claims`
- `## Evidence Quality`
- `## Red-Team Findings`
- `## Uncertainty`
- `## What Would Change This Decision`
- `## Next Tests`

## eval_report.json

Evaluator output for the run.

Required fields:

- `scores`
- `findings`
- `failed_checks`
- `improvement_recommendations`

Required score dimensions:

- `schema_validity`
- `claim_coverage`
- `evidence_traceability`
- `source_quality`
- `contradiction_handling`
- `red_team_strength`
- `uncertainty_quality`
- `decision_usefulness`

## trace.jsonl

Append-only execution trace.

Each line is one JSON object with:

- `timestamp`
- `stage`
- `event_type`
- `message`
- `input_artifacts`
- `output_artifacts`
- `metadata`
