import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceChunks, buildSourceInventory } from "../src/sources.js";

const projectRoot = process.cwd();

test("buildSourceChunks creates stable chunk IDs with source text", async () => {
  const inventory = await buildSourceInventory(projectRoot, {
    question: "Should a frontier AI startup build an enterprise agent platform in 2026?",
    decision_context: "Test source chunking.",
    time_horizon: "12 months",
    output_goal: "decision memo",
    source_pack: "sources/strategic-tech"
  });

  const sourceChunks = await buildSourceChunks(projectRoot, inventory);
  assert.equal(sourceChunks.source_pack.path, "sources/strategic-tech");
  assert.equal(sourceChunks.chunks.length >= inventory.sources.length, true);

  const firstSource = inventory.sources.find((source) => source.id === "S1");
  assert.ok(firstSource);

  const firstChunk = sourceChunks.chunks.find((chunk) => chunk.id === "S1#chunk-001");
  assert.ok(firstChunk);
  assert.equal(firstChunk.source_id, "S1");
  assert.equal(firstChunk.path, firstSource.path);
  assert.match(firstChunk.text, /McKinsey/i);
  assert.equal(firstChunk.content_hash.length, 64);
});

