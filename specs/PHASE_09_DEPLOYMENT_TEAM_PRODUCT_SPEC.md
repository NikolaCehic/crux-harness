# Phase 9 Spec: Deployment And Team Product

Status: started. First implementation slice adds self-hosted Docker Compose deployment for the local API plus secret-safe deployment config reporting.

## Purpose

Make Crux usable by teams in production-like environments.

## Optimality Hypothesis

Team deployment should come after the core harness, UI, review workflow, and API are stable enough to justify operational complexity.

I do not know how to make this phase better without sacrificing the local-first trust contract.

## Scope

- Hosted app.
- Self-hosted Docker.
- Postgres-backed run storage.
- Object storage for source files.
- Auth.
- Workspaces.
- Role-based access control.
- Audit logs.
- Secrets management.
- Model provider configuration.
- Cost tracking.

## Non-Goals

- No marketplace.
- No enterprise SSO in the first slice.
- No multi-region deployment.
- No billing system unless required for hosted pilots.

## Deliverables

- Dockerfile
- docker-compose setup
- database schema
- object storage abstraction
- auth model
- workspace model
- audit log model
- secrets configuration
- deployment docs

## TDD Plan

1. Add tests for persisted run records.
2. Add tests for workspace isolation.
3. Add tests for source file storage references.
4. Add tests for audit log creation.
5. Add tests for provider config loading.
6. Add integration test for Docker startup if practical.
7. Implement storage and deployment layers.

## Acceptance

- A team can run Crux in a self-hosted environment.
- Workspace data is isolated.
- Model keys and source data are handled securely.
- Runs remain auditable over time.
- Local CLI usage still works.
- `npm test` and `npm run benchmark` pass.

## Risks

- Deployment complexity can distract from harness quality.
- Auth and storage decisions can be expensive to unwind.
- Hosted product needs a higher security bar.

## Quality Bar

Deployment must preserve Crux's auditability and replayability instead of turning it into opaque SaaS state.
