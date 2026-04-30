import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import { loadPack, loadPacks, resolvePackForInput } from "../src/packs.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const cliPath = "dist/src/cli.js";

test("loadPack validates a vertical pack manifest", async () => {
  const pack = await loadPack(projectRoot, "packs/investment-diligence/pack.json");

  assert.equal(pack.schema_version, "crux.pack.v1");
  assert.equal(pack.name, "investment-diligence");
  assert.equal(pack.analysis_scope, "investment-diligence");
  assert.equal(pack.source_requirements.min_sources >= 3, true);
  assert.equal(pack.eval_rubric.min_scores.faithfulness, 1);
});

test("loadPacks discovers all committed vertical manifests", async () => {
  const packs = await loadPacks(projectRoot);

  assert.deepEqual(
    packs.map((pack) => pack.name),
    [
      "investment-diligence",
      "market-entry",
      "policy-analysis",
      "product-strategy",
      "root-cause-analysis",
      "scientific-thesis",
      "strategic-tech"
    ]
  );
});

test("resolvePackForInput keeps custom scopes generic", async () => {
  const known = await resolvePackForInput(projectRoot, { analysis_scope: "product-strategy" });
  const custom = await resolvePackForInput(projectRoot, { analysis_scope: "custom" });

  assert.equal(known?.name, "product-strategy");
  assert.equal(custom, undefined);
});

test("loadPack rejects invalid manifests", async () => {
  await assert.rejects(
    () => loadPack(projectRoot, "tests/fixtures/invalid-pack/pack.json"),
    /pack.schema.json|must have required property|must match pattern/
  );
});

test("compiled CLI lists and inspects packs", async () => {
  const list = await execFileAsync(process.execPath, [cliPath, "packs", "list"], { cwd: projectRoot });
  assert.match(list.stdout, /investment-diligence/);
  assert.match(list.stdout, /strategic-tech/);

  const inspect = await execFileAsync(process.execPath, [cliPath, "packs", "inspect", "product-strategy"], { cwd: projectRoot });
  assert.match(inspect.stdout, /Pack: product-strategy/);
  assert.match(inspect.stdout, /Expected evidence/);
});
