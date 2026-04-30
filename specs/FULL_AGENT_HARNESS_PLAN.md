# Full Agent Harness Plan

This is the converged plan for turning Crux from a product-grade local v1 harness into a full marketable agent harness for real-world analysis problems.

## Core Thesis

Crux is a generic modular analysis-agent harness.

Vertical packs are accelerators, not limits.

The core harness should work for any serious analysis scope where the user can provide:

- a question
- decision context
- sources
- claims
- evidence
- contradictions
- uncertainty
- evaluation criteria
- final synthesis requirements

Vertical packs make Crux better for specific markets by adding domain-specific defaults, source expectations, claim taxonomies, rubrics, known failure modes, benchmarks, and memo formats.

## Product Positioning

Crux is the agent harness for decision-grade analysis:

- source-backed
- inspectable
- replayable
- evaluable
- regression-tested
- modular across agent runtimes

Crux should not compete as another generic agent framework. Its strongest market position is as the trust, evaluation, and execution harness around analysis agents.

## Scope Model

Generic custom scopes must remain first-class:

```yaml
analysis_scope: custom
```

Vertical pack scopes should provide stronger defaults:

```yaml
analysis_scope: investment-diligence
vertical_pack: investment-diligence
```

The core reasoning contract must remain the same in both modes.

## Phase Specs

- [Phase 1: Real Source Ingestion](PHASE_01_REAL_SOURCE_INGESTION_SPEC.md)
- [Phase 2: Modular Agent Runtime](PHASE_02_MODULAR_AGENT_RUNTIME_SPEC.md)
- [Phase 3: Harness Contract Layer](PHASE_03_HARNESS_CONTRACT_LAYER_SPEC.md)
- [Phase 4: Trust And Eval Engine](PHASE_04_TRUST_AND_EVAL_ENGINE_SPEC.md)
- [Phase 5: Visual Run Inspector](PHASE_05_VISUAL_RUN_INSPECTOR_SPEC.md)
- [Phase 6: Human Review Workflow](PHASE_06_HUMAN_REVIEW_WORKFLOW_SPEC.md)
- [Phase 7: Vertical Agent Packs](PHASE_07_VERTICAL_AGENT_PACKS_SPEC.md)
- [Phase 8: API, SDK, And Integrations](PHASE_08_API_SDK_INTEGRATIONS_SPEC.md)
- [Phase 9: Deployment And Team Product](PHASE_09_DEPLOYMENT_TEAM_PRODUCT_SPEC.md)
- [Phase 10: Agent Harness Marketplace](PHASE_10_AGENT_HARNESS_MARKETPLACE_SPEC.md)

## Phase 1: Real Source Ingestion

Optimality hypothesis: This is the best first post-v1 phase because real-world usefulness starts when users can bring messy source material into the harness without manually crafting source packs.

Scope:

- ingest PDF, Markdown, TXT, CSV, and URL snapshots
- generate source packs from raw user material
- extract metadata where possible
- preserve source hashes
- support multiple chunking strategies
- validate generated `source_inventory.json`
- validate generated `source_chunks.json`

Non-goals:

- no live autonomous web research yet
- no UI drag-and-drop yet
- no database-backed storage yet

Acceptance:

- a user can provide a folder of real documents
- Crux creates a valid source pack
- every generated source has traceable metadata
- chunks are stable and reproducible
- existing benchmark gates remain green

## Phase 2: Modular Agent Runtime

Optimality hypothesis: This phase should follow real ingestion because model-backed agents are only valuable when they operate over real sources and remain constrained by artifact contracts.

Scope:

- define a formal stage module interface
- make each stage replaceable
- support deterministic and LLM-backed implementations
- add stage-level retries
- add stage-level timeout and budget controls
- add strict input/output schemas per stage
- add trace metadata for every agent call

Agent modules:

- claim decomposer
- source researcher
- evidence mapper
- contradiction finder
- red-team agent
- uncertainty modeler
- memo writer
- evaluator

Acceptance:

- every stage can run deterministically
- selected stages can run with LLMs
- failed model output cannot bypass schemas
- every module records version, prompt, model, budget, and trace metadata

## Phase 3: Harness Contract Layer

Optimality hypothesis: Once stages are modular, Crux needs stronger contracts so users can compare, replay, and trust runs across prompt/model/tool changes.

Scope:

- artifact versioning
- stage versioning
- prompt version locking
- model config locking
- source policy locking
- tool permission locking
- budget enforcement
- replay policy enforcement
- run diffing primitives

Acceptance:

- any run can be replayed from locked config
- two runs can be compared artifact by artifact
- prompt/model/source changes are visible
- Crux can explain why two runs differ

## Phase 4: Trust And Eval Engine

Optimality hypothesis: This is Crux's moat. Observability shows what happened; Crux must explain whether the reasoning is trustworthy.

Scope:

- stronger memo-to-claim faithfulness
- source quote verification
- claim-to-evidence coverage
- unsupported claim detection
- contradiction quality scoring
- uncertainty usefulness scoring
- red-team strength rubric
- hallucination and fabrication detection
- benchmark regression history
- failure diagnosis by stage

Acceptance:

- Crux can detect unsupported memo conclusions
- Crux can detect weak or missing evidence coverage
- Crux can identify whether a failure came from ingestion, claims, evidence, memo writing, or evaluation
- benchmark reports show useful quality changes over time

## Phase 5: Visual Run Inspector

Optimality hypothesis: The UI becomes valuable only after the underlying artifacts are real. At this point Crux needs a product surface for non-engineers.

Scope:

- web UI
- run list
- run summary
- claim graph view
- evidence table
- source excerpt viewer
- contradiction panel
- uncertainty dashboard
- trace timeline
- eval report view
- run comparison view

Acceptance:

- a non-engineer can inspect a run without opening JSON files
- users can move from memo to claim to evidence to source excerpt
- users can see what failed and why

## Phase 6: Human Review Workflow

Optimality hypothesis: Serious analysis workflows require human judgment. Crux should make review structured instead of leaving it in comments or ad hoc docs.

Scope:

- approve or reject claims
- annotate evidence
- edit source mappings
- mark claims as unsupported
- request reruns for individual stages
- maintain review history
- export reviewed memo

Acceptance:

- a reviewer can correct a run without rerunning everything
- review actions are traceable
- final exports distinguish machine output from human-approved output

## Phase 7: Vertical Agent Packs

Optimality hypothesis: Vertical packs are the best marketability layer because they turn the generic harness into immediately useful specialized agents.

Scope:

- investment diligence pack
- market-entry pack
- product strategy pack
- policy analysis pack
- root-cause analysis pack
- technical thesis pack

Each pack includes:

- input template
- source requirements
- claim taxonomy
- expected evidence types
- known failure modes
- eval rubric
- memo format
- benchmark scenarios

Acceptance:

- generic custom runs still work
- vertical runs produce stronger domain-specific artifacts
- vertical benchmarks protect pack quality
- users can create new packs without changing core harness code

## Phase 8: API, SDK, And Integrations

Optimality hypothesis: Crux becomes a platform when existing products and agent systems can call it instead of replacing their runtime.

Scope:

- REST API
- TypeScript SDK
- Python SDK
- webhooks
- CI integration
- OpenAI Agents SDK adapter
- LangGraph adapter
- trace export for observability tools
- connector interfaces for future Notion, Slack, GitHub, and document systems

Acceptance:

- external systems can create runs
- external systems can fetch artifacts and eval reports
- Crux can wrap existing agent runtimes
- Crux can export traces and scores to external observability systems

## Phase 9: Deployment And Team Product

Optimality hypothesis: Team deployment should come after the core harness, UI, review, and API are stable enough to justify operational complexity.

Scope:

- hosted app
- self-hosted Docker
- Postgres-backed run storage
- object storage for source files
- auth
- workspaces
- role-based access control
- audit logs
- secrets management
- model provider configuration
- cost tracking

Acceptance:

- a team can run Crux in production
- workspace data is isolated
- model keys and source data are handled securely
- runs remain auditable over time

## Phase 10: Agent Harness Marketplace

Optimality hypothesis: A marketplace should come last because reusable modules only matter after the harness has proven durable contracts and real team usage.

Scope:

- reusable stage modules
- vertical packs
- evaluator packs
- source-ingestion plugins
- prompt packs
- benchmark suites
- certified harness templates

Acceptance:

- users can install and compose packs
- packs declare compatibility with artifact versions
- pack quality is benchmarked
- the ecosystem extends Crux without weakening core contracts

## Immediate Next Step

Start Phase 1: Real Source Ingestion.

The first implementation slice should be:

1. Add tests for generating a source pack from raw Markdown/TXT input.
2. Implement `crux sources import <inputDir> --out <sourcePackDir>`.
3. Generate metadata stubs and content hashes.
4. Reuse existing source inventory and chunk validators.
5. Add one fixture with mixed raw source files.
6. Run `npm test` and `npm run benchmark`.

This is the most optimal next step because it converts Crux from curated benchmark source packs into a harness that can accept real user material while preserving the v1 trust contract.
