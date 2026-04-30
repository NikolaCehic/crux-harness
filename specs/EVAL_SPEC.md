# Eval Spec

## Purpose

Crux should improve by measurement, not vibes.

The eval system judges whether a run produced useful, trustworthy, decision-grade analysis artifacts.

## Evaluation Modes

### Schema Eval

Checks that every structured artifact is valid against its schema.

Pass/fail.

### Structural Eval

Checks whether the run has the right reasoning shape:

- clear decision framing
- atomic claims
- mapped evidence
- explicit contradictions
- meaningful uncertainty
- decision memo grounded in prior artifacts

### Faithfulness Eval

Checks whether the final memo only makes claims supported by `claims.json` and `evidence.json`, or clearly marks unsupported claims as uncertain.

### Adversarial Eval

Checks whether the red team seriously challenges the recommendation.

Weak red-team behavior includes:

- generic objections
- objections that do not affect the decision
- failure modes with no mechanism
- missing evidence that would not change the conclusion

### Decision Usefulness Eval

Checks whether a serious user can act on the output.

The decision memo should include:

- recommendation
- rationale
- critical assumptions
- confidence
- risks
- next tests

## Score Dimensions

Scores are 0 to 1.

### schema_validity

Whether all artifacts satisfy required schemas.

### claim_coverage

Whether the claim graph covers the major reasoning required by the question.

### claim_graph_integrity

Whether the claim graph avoids duplicate IDs, missing roots, missing dependencies, self-dependencies, and dependency cycles.

### evidence_traceability

Whether important claims link to evidence or are explicitly marked unsupported.

### source_quality

Whether evidence is relevant, reliable, recent enough, and diverse enough.

### contradiction_handling

Whether the system surfaces and handles conflicting evidence.

### red_team_strength

Whether the opposing case is strong enough to potentially change the recommendation.

### uncertainty_quality

Whether uncertainties are specific, decision-relevant, and connected to tests.

### faithfulness

Whether the final memo maps back to `claims.json`, avoids unsupported certainty, and preserves source/evidence caveats.

### crux_quality

Whether the run exposes the crux of the decision through high-severity contradictions, what-would-change-my-mind entries, and decision-relevant next tests.

### decision_usefulness

Whether the final memo helps a user make or defer a decision.

## Required Eval Report Shape

```json
{
  "scores": {
    "schema_validity": 1.0,
    "claim_graph_integrity": 0.0,
    "claim_coverage": 0.0,
    "evidence_traceability": 0.0,
    "source_quality": 0.0,
    "contradiction_handling": 0.0,
    "red_team_strength": 0.0,
    "uncertainty_quality": 0.0,
    "faithfulness": 0.0,
    "crux_quality": 0.0,
    "decision_usefulness": 0.0
  },
  "findings": [],
  "failed_checks": [],
  "improvement_recommendations": [],
  "council": {
    "schema_version": "crux.eval_council.v1",
    "reviewers": [],
    "disagreements": [],
    "synthesis": {
      "status": "pass",
      "confidence": 1.0,
      "blocking_failures": [],
      "next_fixes": []
    }
  }
}
```

## v0.1 Quality Gate

A run is acceptable only if:

- all schemas pass
- `schema_validity` is `1.0`
- no critical claim is both unsupported and hidden from the memo
- the red team includes at least one objection that could change the recommendation
- the memo includes what would change the decision

## Golden Test Set

The first benchmark set should contain 10 hard questions:

- 3 strategic technology decisions
- 2 investment or diligence decisions
- 2 policy or governance decisions
- 2 product strategy decisions
- 1 scientific or technical thesis evaluation

Each benchmark should define:

- input question
- expected artifact qualities
- known traps
- evaluation notes
