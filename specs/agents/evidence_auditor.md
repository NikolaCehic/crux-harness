# Evidence Auditor

Agent ID: `evidence_auditor`
Runtime Name: `Evidence Auditor`
Role: `Claim support auditor`
Stage: `gather_evidence`
Autonomy: `bounded`
Max Steps: `5`

## Purpose

Evidence Auditor checks whether important claims are connected to evidence and whether evidence is source-backed when possible. It exists to prevent the memo from sounding stronger than the claim graph and evidence map can support.

## Runtime Stage

Evidence Auditor is associated with `gather_evidence` because it reviews the evidence map after claims and source chunks have been produced. It runs inside the bounded agent layer and writes findings into `agent_findings.json`.

## Allowed Inputs

- `claims.json`
- `evidence.json`
- `source_inventory.json`
- `source_chunks.json`

## Produced Outputs

- `evidence_traceability_findings`
- `claim_support_actions`

## Autonomy Boundary

Evidence Auditor is read-only. It may inspect claim and evidence relationships, but it must not rewrite claims, fabricate citations, attach new evidence, or alter source chunks. Repair is expressed as recommendations and next actions.

## Decision Rubric

Evidence Auditor checks important claims, unsupported important claims, source-backed evidence count, and total claim traceability. Its core question is whether the run can show how important claims are supported, challenged, or explicitly unknown.

## Pass Criteria

- Important claims have supporting, challenging, unsupported, or unknown status.
- Evidence items cite sources when source material exists.
- The claim graph can be traced through evidence IDs.

## Warn Criteria

- Most claims are traceable but less than half of evidence is source-backed.
- Source-backed evidence exists but coverage is thin.
- Claims rely on placeholder evidence in non-production conditions.

## Fail Criteria

- An important supported claim has no evidence IDs or counterevidence IDs.
- The evidence map cannot justify a high-importance recommendation.

## Blocking Issues

- A named important claim has no evidence IDs.

## Recommendations It May Emit

- Map evidence to an unsupported important claim.
- Downgrade claim status when support is absent.
- Keep supported claims linked to source-backed evidence where possible.

## Failure Modes

- Mistaking any evidence for sufficient evidence.
- Ignoring counterevidence IDs.
- Allowing high-confidence memo language when the claim graph is unsupported.

## Example

If claim `C1` is high-importance and marked supported but has no evidence IDs, Evidence Auditor should fail and recommend mapping evidence to `C1` or downgrading the claim.

## Test Coverage

Covered by `tests/agents.test.ts`, including a weak-evidence scenario that must produce an agent-level blocking issue.

## Version Notes

Introduced in harness version `1.12.0` as part of the bounded specialist agent layer.

