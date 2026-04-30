import assert from "node:assert/strict";
import type { Server } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createCruxApiServer } from "../src/api.js";
import { CruxLocalSdk } from "../src/sdk.js";

const projectRoot = process.cwd();
const exampleInput = "examples/frontier-agent-platform.yaml";

process.env.CRUX_CLAIM_DECOMPOSER = "deterministic";
process.env.CRUX_EVIDENCE_MAPPER = "deterministic";
delete process.env.CRUX_LLM_PROVIDER;
delete process.env.CRUX_LLM_API_KEY;

test("local API creates runs and fetches eval reports and artifacts", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const created = await postJson(`${baseUrl}/runs`, { input: exampleInput });
    assert.equal(typeof created.run_id, "string");
    assert.equal(typeof created.run_dir, "string");

    const evalReport = await getJson(`${baseUrl}/runs/${created.run_id}/eval`);
    assert.equal(evalReport.scores.schema_validity, 1);
    assert.equal(evalReport.council.synthesis.status, "pass");

    const claims = await getJson(`${baseUrl}/runs/${created.run_id}/artifacts/claims.json`);
    assert.equal(claims.claims.length, 12);
  } finally {
    await closeServer(server);
  }
});

test("local API rejects path traversal artifact requests", async () => {
  const { server, baseUrl } = await startTestServer();
  try {
    const created = await postJson(`${baseUrl}/runs`, { input: exampleInput });
    const response = await fetch(`${baseUrl}/runs/${created.run_id}/artifacts/../run_config.json`);
    assert.equal(response.status, 400);
  } finally {
    await closeServer(server);
  }
});

test("CruxLocalSdk creates runs and loads artifacts without shelling out", async () => {
  const sdk = new CruxLocalSdk({ projectRoot });
  const run = await sdk.createRun(exampleInput);
  const evalReport = await sdk.getEvalReport(run.run_dir);
  const evidence = await sdk.getArtifact<{ evidence: unknown[] }>(run.run_dir, "evidence.json");

  assert.equal(evalReport.scores.schema_validity, 1);
  assert.equal(evidence.evidence.length, 8);
});

async function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  const server = createCruxApiServer(projectRoot);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address.");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function closeServer(server: Server): Promise<void> {
  server.close();
  await once(server, "close");
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  if (response.status !== 200) {
    assert.fail(await response.text());
  }
  return response.json();
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url);
  if (response.status !== 200) {
    assert.fail(await response.text());
  }
  return response.json();
}
