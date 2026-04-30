# Product Spec

## Name

Crux Harness

## One-Line Definition

Crux is a reproducible execution and evaluation harness for analysis agents that turn hard questions into structured, testable, decision-grade reasoning artifacts.

## Product Thesis

The next important analysis agent will not merely synthesize information. It will make beliefs explicit, inspectable, falsifiable, and revisable.

Most AI research and analysis tools optimize for fluent final answers. Crux optimizes for the intermediate structure that makes an answer trustworthy:

- what claims are being made
- what evidence supports each claim
- what evidence conflicts with each claim
- what assumptions drive the conclusion
- how uncertainty should be represented
- what would change the recommendation
- how the system judged its own work

## Primary User

The initial user is a high-agency decision maker or team making expensive decisions under uncertainty.

Examples:

- frontier technology founders
- AI lab strategy teams
- research organization leads
- fund analysts and investment committees
- policy and governance teams
- technical operators choosing product or research direction

## Initial Wedge

Crux v1 focuses on high-stakes analytical decisions that benefit from explicit claims, source-backed evidence, uncertainty, and replayable evaluation.

Example questions:

- Should a frontier AI startup build an enterprise agent platform in 2026?
- Is this technical market thesis defensible?
- Which assumption most threatens this roadmap?
- What evidence would make this strategy fail?
- Should this organization invest in a given technical direction?

The committed benchmark suite covers strategic technology, investment diligence, policy analysis, product strategy, scientific thesis evaluation, market entry, and root-cause analysis.

## Non-Goals

Crux v0.1 is not:

- a general chatbot
- a polished web app
- a slide generator
- a generic deep research clone
- an automated source of final authority
- a replacement for domain experts

## Success Criteria

A successful Crux run produces artifacts that a serious user can audit.

The user should be able to answer:

- What is the recommendation?
- What claims does it depend on?
- Which claims are weak or contested?
- Which evidence supports each claim?
- Which assumptions matter most?
- What would change the conclusion?
- How confident is the system, and why?
- Where did the system fail or remain uncertain?

## Product Principles

### Falsifiability First

Every important conclusion should be traceable to explicit claims and evidence.

### Structured Before Polished

Markdown prose is useful, but only after structured artifacts exist.

### Red Team Is Core

The red-team step should be capable of weakening or overturning the conclusion.

### Uncertainty Is A First-Class Output

Crux should never hide behind confident prose when the evidence is ambiguous.

### Replayability Over Magic

Runs should be inspectable, comparable, and reproducible enough to support iterative improvement.

## North Star

Crux becomes the reasoning infrastructure layer for high-stakes analysis agents.
