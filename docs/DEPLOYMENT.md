# Deployment

## Self-hosted Local API

Crux can run as a local-first API service with Docker Compose:

```bash
docker compose up --build
```

The API listens on:

```text
http://127.0.0.1:4317
```

Health check:

```bash
curl http://127.0.0.1:4317/health
```

Create a run:

```bash
curl -X POST http://127.0.0.1:4317/runs \
  -H "content-type: application/json" \
  -d '{"input":"examples/frontier-agent-platform.yaml"}'
```

## Secrets

Model provider secrets are supplied through environment variables. The deployment config reports whether a key is present, but it does not expose the key value.

```bash
export CRUX_LLM_PROVIDER=openai-compatible
export CRUX_LLM_API_KEY=...
docker compose up --build
```

## State

The compose file stores generated runs in the `crux_runs` Docker volume. Source packs, examples, schemas, packs, and specs are included in the image so benchmark and example runs keep the same local contract as the CLI.

## Current Boundary

This deployment slice intentionally does not add auth, Postgres, object storage, or multi-workspace permissions. Those layers should build on this API contract without changing run artifacts.
