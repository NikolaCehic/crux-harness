# Phase 8 Spec: API, SDK, And Integrations

Status: started. First implementation slice adds a local HTTP API server, TypeScript local SDK, and OpenAPI contract for run creation and artifact/eval retrieval.

## Purpose

Let external products, CI systems, and agent runtimes use Crux without shelling directly into the CLI.

## Optimality Hypothesis

Crux becomes a platform when existing products and agent systems can call it instead of replacing their runtime.

I do not know how to make this phase better without building deployment infrastructure before the integration contracts are stable.

## Scope

- REST API.
- TypeScript SDK.
- Python SDK.
- Webhooks.
- CI integration.
- OpenAI Agents SDK adapter.
- LangGraph adapter.
- Trace export for observability tools.
- Connector interfaces for future Notion, Slack, GitHub, and document systems.

## Non-Goals

- No hosted app requirement.
- No full connector marketplace.
- No auth beyond local development tokens.
- No long-term storage guarantee.

## Deliverables

- local API server
- OpenAPI spec
- TypeScript SDK
- Python SDK
- webhook event model
- adapter interface
- sample integration tests

## TDD Plan

1. Add tests for creating a run through the API.
2. Add tests for fetching artifacts through the API.
3. Add tests for fetching eval reports through the API.
4. Add tests for SDK run creation.
5. Add tests for webhook payload shape.
6. Add tests for adapter trace export.
7. Implement API, SDKs, and adapters incrementally.

## Acceptance

- External systems can create runs.
- External systems can fetch artifacts and eval reports.
- Crux can wrap existing agent runtimes.
- Crux can export traces and scores to external observability systems.
- `npm test` and `npm run benchmark` pass.

## Risks

- API surface can freeze too early.
- SDKs can drift from CLI behavior.
- Integrations can become a maintenance burden.

## Quality Bar

The API and SDKs must expose Crux's core contracts, not a separate product behavior.
