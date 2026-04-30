# Run Spec

## Purpose

The run spec defines how Crux executes a single analysis task.

The harness must make runs:

- deterministic where practical
- auditable
- replayable
- comparable across versions

## CLI Target

The intended v0.1 interface:

```bash
crux run examples/frontier-agent-platform.yaml
crux eval runs/<run_id>
crux replay runs/<run_id>
```

## Run Lifecycle

### 1. Initialize

Inputs:

- `input.yaml`

Outputs:

- run directory
- copied `input.yaml`
- initial `trace.jsonl`

### 2. Normalize Question

Inputs:

- `input.yaml`

Outputs:

- `question_spec.json`

Responsibilities:

- identify decision type
- extract context and constraints
- define success criteria
- identify initial unknowns

### 3. Build Initial Claim Graph

Inputs:

- `question_spec.json`

Outputs:

- `claims.json`

Responsibilities:

- decompose the question into atomic claims
- mark root decision claims
- assign initial claim types and importance
- identify dependencies

### 4. Gather Evidence

Inputs:

- `question_spec.json`
- `claims.json`

Outputs:

- `evidence.json`

Responsibilities:

- gather or ingest evidence
- summarize evidence
- map evidence to claim IDs
- score source reliability and relevance

### 5. Verify Claims

Inputs:

- `claims.json`
- `evidence.json`

Outputs:

- updated `claims.json`
- `contradictions.json`

Responsibilities:

- update claim status and confidence
- identify unsupported critical claims
- detect conflicting evidence
- recommend evidence gaps to close

### 6. Red Team

Inputs:

- `question_spec.json`
- `claims.json`
- `evidence.json`
- `contradictions.json`

Outputs:

- `red_team.md`

Responsibilities:

- produce the strongest opposing thesis
- identify failure modes
- identify missing evidence
- estimate impact on the recommendation

### 7. Model Uncertainty

Inputs:

- `claims.json`
- `evidence.json`
- `contradictions.json`
- `red_team.md`

Outputs:

- `uncertainty.json`

Responsibilities:

- identify the highest-impact uncertainties
- estimate confidence
- run sensitivity-style reasoning
- define what would change the conclusion
- propose cheap tests

### 8. Write Decision Memo

Inputs:

- all prior artifacts

Outputs:

- `decision_memo.md`

Responsibilities:

- produce a clear recommendation
- expose reasoning structure
- include red-team and uncertainty caveats
- name next tests

### 9. Evaluate

Inputs:

- all run artifacts

Outputs:

- `eval_report.json`

Responsibilities:

- validate schemas
- score artifact quality
- identify reasoning gaps
- recommend improvements

## Stage Contract

Every stage must:

- read declared input artifacts only
- write declared output artifacts only
- append to `trace.jsonl`
- validate outputs before completing
- fail loudly on invalid schemas

## Source Policy

v0.1 supports three source modes:

- `offline`: use only provided docs and examples
- `web`: allow live web research
- `hybrid`: use provided docs first, web second

The default for early development is `offline` or curated examples, so harness behavior can be tested before relying on live search.

## Replay Policy

A replay should preserve:

- original input
- source mode
- model settings
- tool budget
- harness version
- prompts or agent configs

Replay may not produce byte-identical outputs when external models are used, but it should produce comparable artifacts and evaluation scores.

