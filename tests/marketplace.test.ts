import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { installLocalPack, loadMarketplace, verifyMarketplace } from "../src/marketplace.js";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const cliPath = "dist/src/cli.js";

test("loadMarketplace validates the local marketplace catalog", async () => {
  const marketplace = await loadMarketplace(projectRoot);

  assert.equal(marketplace.schema_version, "crux.marketplace.v1");
  assert.equal(marketplace.entries.length >= 7, true);
  assert.equal(marketplace.entries.every((entry) => entry.compatibility.harness_major === 1), true);
});

test("verifyMarketplace resolves compatible certified packs", async () => {
  const report = await verifyMarketplace(projectRoot);

  assert.equal(report.compatible, true);
  assert.equal(report.entries.length >= 7, true);
  assert.equal(report.entries.every((entry) => entry.compatible), true);
  assert.equal(report.entries.every((entry) => entry.certification.status === "certified"), true);
});

test("verifyMarketplace rejects incompatible artifact versions", async () => {
  const report = await verifyMarketplace(projectRoot, "tests/fixtures/incompatible-marketplace/marketplace.json");

  assert.equal(report.compatible, false);
  assert.equal(report.entries.some((entry) => {
    return !entry.compatible && entry.issues.some((issue) => issue.includes("eval_report.json"));
  }), true);
});

test("installLocalPack installs a valid pack into a target registry", async () => {
  const targetDir = path.join("test-results", `packs-install-${process.pid}-${Date.now()}`);
  await mkdir(path.join(projectRoot, targetDir), { recursive: true });

  const installed = await installLocalPack(projectRoot, "packs/product-strategy/pack.json", targetDir);

  assert.equal(installed.name, "product-strategy");
  assert.equal(existsSync(path.join(projectRoot, targetDir, "product-strategy", "pack.json")), true);
});

test("compiled CLI lists, verifies, and installs marketplace packs", async () => {
  const list = await execFileAsync(process.execPath, [cliPath, "marketplace", "list"], { cwd: projectRoot });
  assert.match(list.stdout, /certified/);
  assert.match(list.stdout, /product-strategy/);

  const verify = await execFileAsync(process.execPath, [cliPath, "marketplace", "verify"], { cwd: projectRoot });
  assert.match(verify.stdout, /Marketplace compatible: yes/);

  const targetDir = path.join("test-results", `marketplace-cli-${process.pid}-${Date.now()}`);
  const install = await execFileAsync(process.execPath, [
    cliPath,
    "marketplace",
    "install",
    "packs/product-strategy/pack.json",
    "--to",
    targetDir
  ], { cwd: projectRoot });
  assert.match(install.stdout, /Installed pack: product-strategy/);
});
