import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { importSources } from "../src/source-importer.js";
import { buildSourceChunks, buildSourceInventory } from "../src/sources.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const fixtureDir = path.join(projectRoot, "tests", "fixtures", "raw-sources");
const cliPath = "dist/src/cli.js";

test("importSources converts raw files into a valid deterministic source pack", async () => {
  const outputDir = path.join(projectRoot, "test-results", `source-importer-${process.pid}-${Date.now()}`);
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.dirname(outputDir), { recursive: true });

  const report = await importSources({ inputDir: fixtureDir, outputDir });

  assert.equal(report.imported_count, 3);
  assert.equal(report.skipped_count, 1);
  assert.deepEqual(report.sources.map((source) => source.id), ["S1", "S2", "S3"]);
  assert.deepEqual(report.skipped.map((file) => path.basename(file.path)), ["ignore.json"]);

  const generated = await readFile(path.join(outputDir, "s1-market-note.md"), "utf8");
  assert.match(generated, /id: S1/);
  assert.match(generated, /source_type: internal_document/);
  assert.match(generated, /citation: "Imported source: Market Note"/);
  assert.match(generated, /Enterprise buyers increasingly ask/);

  const sourcePack = path.relative(projectRoot, outputDir);
  const inventory = await buildSourceInventory(projectRoot, {
    question: "Should we use imported sources?",
    decision_context: "Testing source import.",
    time_horizon: "30 days",
    output_goal: "decision memo",
    source_pack: sourcePack
  });
  assert.deepEqual(inventory.sources.map((source) => source.id), ["S1", "S2", "S3"]);
  assert.equal(inventory.sources.find((source) => source.id === "S3")?.source_type, "dataset");

  const chunks = await buildSourceChunks(projectRoot, inventory);
  assert.equal(chunks.chunks.length >= 3, true);
  assert.equal(chunks.chunks.every((chunk) => chunk.content_hash.length === 64), true);
});

test("compiled CLI imports raw sources and prints a report", async () => {
  const outputDir = path.join(projectRoot, "test-results", `source-importer-cli-${process.pid}-${Date.now()}`);
  await rm(outputDir, { recursive: true, force: true });

  const { stdout } = await execFileAsync(process.execPath, [cliPath, "sources", "import", fixtureDir, "--out", outputDir], { cwd: projectRoot });

  assert.match(stdout, /Imported 3 sources/);
  assert.match(stdout, /Skipped 1 files/);
  assert.match(stdout, /s1-market-note\.md/);
  assert.match(stdout, /ignore\.json/);
});
