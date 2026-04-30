import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { runHarness } from "./pipeline.js";

export type CruxApiRunResponse = {
  run_id: string;
  run_dir: string;
};

export function createCruxApiServer(projectRoot: string): Server {
  return createServer(async (request, response) => {
    try {
      await routeRequest(projectRoot, request, response);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
}

async function routeRequest(projectRoot: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/runs") {
    const body = await readJsonBody<{ input?: string }>(request);
    if (!body.input || typeof body.input !== "string") {
      sendJson(response, 400, { error: "POST /runs requires JSON body with string field: input" });
      return;
    }

    const run = await runHarness(projectRoot, body.input);
    sendJson(response, 200, {
      run_id: run.runId,
      run_dir: path.relative(projectRoot, run.runDir)
    } satisfies CruxApiRunResponse);
    return;
  }

  if (request.method === "GET" && parts.length === 3 && parts[0] === "runs" && parts[2] === "eval") {
    const runDir = resolveRunDir(projectRoot, parts[1]);
    sendJson(response, 200, await readJson(path.join(runDir, "eval_report.json")));
    return;
  }

  if (request.method === "GET" && parts.length === 4 && parts[0] === "runs" && parts[2] === "artifacts") {
    const artifactName = parts[3];
    if (!isSafeArtifactName(artifactName)) {
      sendJson(response, 400, { error: "Artifact name must be a file name inside the run directory." });
      return;
    }

    const artifactPath = path.join(resolveRunDir(projectRoot, parts[1]), artifactName);
    if (artifactName.endsWith(".json")) {
      sendJson(response, 200, await readJson(artifactPath));
    } else {
      sendText(response, 200, await readFile(artifactPath, "utf8"));
    }
    return;
  }

  if (request.method === "GET" && parts.length >= 3 && parts[0] === "runs" && parts[2] !== "eval") {
    sendJson(response, 400, { error: "Invalid run API path." });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

function resolveRunDir(projectRoot: string, runIdOrDir: string): string {
  if (runIdOrDir === "latest") {
    return path.join(projectRoot, "runs", "latest");
  }
  if (runIdOrDir.includes("/") || runIdOrDir.includes("..")) {
    throw new Error(`Invalid run ID: ${runIdOrDir}`);
  }

  return path.join(projectRoot, "runs", runIdOrDir);
}

function isSafeArtifactName(value: string): boolean {
  return path.basename(value) === value && !value.includes("..") && value.length > 0;
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) as T : {} as T;
}

async function readJson(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(body, null, 2)}\n`);
}

function sendText(response: ServerResponse, status: number, body: string): void {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8"
  });
  response.end(body);
}
