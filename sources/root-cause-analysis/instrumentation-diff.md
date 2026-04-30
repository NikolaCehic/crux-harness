---
id: S2
title: Instrumentation Diff Review
source_type: internal_document
citation: "Crux analytics review, instrumentation diff for activation events, 2026"
url: ""
published: "2026-04-30"
summary: "Instrumentation changes can create an apparent activation drop even when user behavior has not changed."
reliability: 0.84
recency: 0.85
relevance: 0.92
tags: root-cause-analysis, instrumentation, activation
---

Instrumentation changes can create an apparent activation drop even when user behavior has not changed.

The analysis should compare event definitions, client releases, tracking failures, and cohort inclusion rules before attributing the drop to product friction.

Ruling out instrumentation is necessary before the growth and product team decides whether to roll back the onboarding redesign.
