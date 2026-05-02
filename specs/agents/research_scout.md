# Research Scout

Agent ID: `research_scout`
Runtime Name: `Research Scout`
Role: `Source gap planner`
Stage: `ingest_sources`
Autonomy: `bounded`
Max Steps: `4`

## Purpose

Research Scout determines whether a run has enough source material to support decision-quality analysis. It does not perform research itself. It identifies source gaps, counts available sources and chunks, and turns missing-evidence needs into concrete collection actions.

## Runtime Stage

Research Scout is associated with `ingest_sources` because it reviews the result of source ingestion. It runs later in the bounded agent layer, after the source inventory, chunks, claims, evidence, contradictions, uncertainty, red-team critique, and memo exist.

## Allowed Inputs

- `question_spec.json`
- `source_inventory.json`
- `source_chunks.json`
- `contradictions.json`

## Produced Outputs

- `source_gap_findings`
- `source_collection_actions`

## Autonomy Boundary

Research Scout is read-only. It may inspect source and contradiction artifacts, but it must not browse, fetch documents, edit source packs, change claims, or invent evidence. Its output is limited to findings and next actions inside `agent_findings.json`.

## Decision Rubric

Research Scout checks source count, chunk count, and the missing-evidence list. Its core question is whether a human reviewer can see what evidence is present and what evidence still needs to be collected before the run is trusted.

## Pass Criteria

- The run has attached source material.
- Source chunks exist when sources exist.
- Missing-evidence needs are limited and actionable.
- The next collection action is visible.

## Warn Criteria

- No source material is attached.
- Missing evidence is broad enough to limit production use.
- Source chunks exist but leave important evidence needs unanswered.

## Fail Criteria

Research Scout normally warns rather than fails because it cannot prove claim support by itself. Failure should be reserved for future versions where required source packs are declared but absent or unreadable.

## Blocking Issues

- No source material is attached to the run.

## Recommendations It May Emit

- Collect evidence for the top missing-evidence items.
- Keep source pack coverage linked to the decision crux.
- Regenerate the run after adding source material.

## Failure Modes

- Treating placeholder evidence as sufficient source coverage.
- Listing too many vague evidence needs instead of prioritizing the top gaps.
- Confusing source collection planning with actual research.

## Example

If `source_inventory.json` has zero sources and `contradictions.json` lists customer proof as missing, Research Scout should warn and emit a next action to collect customer evidence before the run is used operationally.

## Test Coverage

Covered by `tests/agents.test.ts`, which verifies the manifest, generated findings, weak-evidence behavior, and spec drift.

## Version Notes

Introduced in harness version `1.12.0` as part of the bounded specialist agent layer.

