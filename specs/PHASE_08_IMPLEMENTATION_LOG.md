# Phase 8 Implementation Log: API, SDK, And Integrations

This log records implementation decisions and file-level changes for Phase 8 so the work can be backtracked safely.

## 2026-04-30: Start Local API And SDK Slice

Goal:

- Add a local HTTP API server without new runtime dependencies.
- Let external systems create runs without shelling into the CLI.
- Let external systems fetch artifacts and eval reports.
- Add a TypeScript SDK wrapper over the existing local contracts.
- Document the HTTP surface with an OpenAPI contract.

Planned files:

- `src/api.ts`: local HTTP API server.
- `src/sdk.ts`: TypeScript local SDK.
- `src/cli.ts`: `crux api` command.
- `tests/api-sdk.test.ts`: TDD coverage for run creation, eval/artifact fetch, path traversal rejection, and SDK behavior.
- `specs/openapi.crux.v1.json`: OpenAPI contract for the local API.
- `README.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`: document and version the Phase 8 slice.

Backtrack note:

- The API calls existing pipeline and artifact readers; it does not introduce separate execution behavior.
- The SDK is local and dependency-free, so removing it does not affect CLI behavior.
- The server rejects artifact path traversal and only serves file names inside a run directory.

## 2026-04-30: Local API And SDK Added

Files changed:

- `src/api.ts`: added local HTTP server with health check, run creation, eval fetch, artifact fetch, JSON/text responses, and artifact path validation.
- `src/sdk.ts`: added `CruxLocalSdk` with `createRun`, `getEvalReport`, and `getArtifact`.
- `src/cli.ts`: added `crux api --host <host> --port <port>`.
- `tests/api-sdk.test.ts`: added API and SDK tests.
- `specs/openapi.crux.v1.json`: documented the local API contract.
- `README.md`, `CHANGELOG.md`, `specs/PHASE_08_API_SDK_INTEGRATIONS_SPEC.md`, `package.json`, `package-lock.json`: documented and versioned the Phase 8 slice.

Verification:

- `npm test`: 56/56 passing.
- `npm run benchmark`: 7/7 benchmark scenarios passing, 0 regressions.

Optimality checkpoint:

- This is the most optimal first Phase 8 slice because it exposes the existing harness contracts to external callers without introducing hosted state, auth, queues, or provider-specific adapters too early.
- I do not know how to make this slice better without expanding into deployment concerns before the API and SDK contracts are stable.
