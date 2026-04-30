import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { loadDeploymentConfig } from "../src/deployment-config.js";

test("deployment config reports provider readiness without exposing secrets", () => {
  const config = loadDeploymentConfig({
    CRUX_LLM_PROVIDER: "openai-compatible",
    CRUX_LLM_MODEL: "gpt-4.1-mini",
    CRUX_LLM_API_KEY: "secret-value"
  });

  assert.equal(config.api.host, "0.0.0.0");
  assert.equal(config.api.port, 4317);
  assert.equal(config.model.provider, "openai-compatible");
  assert.equal(config.model.model, "gpt-4.1-mini");
  assert.equal(config.model.has_api_key, true);
  assert.equal(JSON.stringify(config).includes("secret-value"), false);
});

test("Docker deployment files run the local API and avoid copying local state", async () => {
  const [dockerfile, compose, dockerignore, docs] = await Promise.all([
    readFile("Dockerfile", "utf8"),
    readFile("docker-compose.yml", "utf8"),
    readFile(".dockerignore", "utf8"),
    readFile("docs/DEPLOYMENT.md", "utf8")
  ]);

  assert.match(dockerfile, /npm ci/);
  assert.match(dockerfile, /npm run build/);
  assert.match(dockerfile, /"node", "dist\/src\/cli\.js", "api"/);
  assert.match(compose, /4317:4317/);
  assert.match(compose, /CRUX_LLM_API_KEY/);
  assert.match(dockerignore, /runs/);
  assert.match(dockerignore, /node_modules/);
  assert.match(docs, /Self-hosted/);
  assert.equal(compose.includes("secret-value"), false);
});
