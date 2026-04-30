# Phase 9 Implementation Log: Deployment And Team Product

This log records implementation decisions and file-level changes for Phase 9 so the work can be backtracked safely.

## 2026-04-30: Start Self-Hosted API Deployment Slice

Goal:

- Add a self-hosted Docker path for the local API.
- Keep deployment local-first and dependency-light.
- Add deployment config that reports provider readiness without exposing secrets.
- Document state, secrets, and current deployment boundaries.

Planned files:

- `Dockerfile`: production API image.
- `docker-compose.yml`: self-hosted local API setup.
- `.dockerignore`: keep local state out of image context.
- `docs/DEPLOYMENT.md`: deployment guide.
- `src/deployment-config.ts`: secret-safe deployment config loader.
- `tests/deployment.test.ts`: TDD coverage for deployment config and Docker/Compose manifests.
- `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`: document and version the Phase 9 slice.

Backtrack note:

- Deployment files do not change CLI, API, SDK, pipeline, eval, review, or benchmark behavior.
- Docker state is stored in volumes, while local `runs` and `test-results` are excluded from the image context.
- `loadDeploymentConfig` exposes whether a key exists, not the key value.

## 2026-04-30: Self-Hosted API Deployment Added

Files changed:

- `Dockerfile`: added multi-stage build and runtime image for `node dist/src/cli.js api`.
- `docker-compose.yml`: added local API service, port mapping, named volumes, environment configuration, and health check.
- `.dockerignore`: excluded local state and dependency/build folders.
- `docs/DEPLOYMENT.md`: documented self-hosted API startup, health checks, run creation, secrets, and state boundary.
- `src/deployment-config.ts`: added secret-safe API/model deployment config.
- `tests/deployment.test.ts`: added deployment config and manifest tests.
- `README.md`, `CHANGELOG.md`, `specs/PHASE_09_DEPLOYMENT_TEAM_PRODUCT_SPEC.md`, `package.json`, `package-lock.json`: documented and versioned the Phase 9 slice.

Verification:

- `npm test`: 58/58 passing.
- `npm run benchmark`: 7/7 benchmark scenarios passing, 0 regressions.

Optimality checkpoint:

- This is the most optimal first Phase 9 slice because it gives teams a real self-hosted API path without adding auth, Postgres, object storage, or workspace permissions before the local API contract is stable.
- I do not know how to make this slice better without creating deployment complexity that would distract from Crux's auditability and replayability.
