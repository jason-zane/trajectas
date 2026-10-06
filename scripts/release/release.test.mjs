import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { needsSeededE2E, changedPaths } from "./change-scope.mjs";
import { gateFailures } from "./check-gate.mjs";

function evidence(scope = "true", result = "success") {
  return {
    "change-scope": { result: "success", outputs: { seeded: scope } },
    security: { result: "success" }, quality: { result: "success" },
    integration: { result: "success" }, "e2e-smoke": { result: "success" },
    "seeded-e2e": { result },
  };
}

test("gate only accepts success and a scoped seeded skip", () => {
  assert.deepEqual(gateFailures(evidence()), []);
  assert.deepEqual(gateFailures(evidence("false", "skipped")), []);
  for (const name of Object.keys(evidence())) {
    for (const result of ["failure", "cancelled", "skipped", "unknown", undefined]) {
      const jobs = evidence();
      jobs[name].result = result;
      assert.ok(gateFailures(jobs).length, `${name}=${result} must fail`);
    }
  }
  for (const scope of [undefined, "", "TRUE", "unexpected"]) {
    const jobs = evidence("true", "skipped");
    jobs["change-scope"].outputs.seeded = scope;
    assert.ok(gateFailures(jobs).length);
  }
  for (const result of ["failure", "cancelled", "unknown", undefined]) {
    const jobs = evidence("false");
    jobs["seeded-e2e"].result = result;
    assert.ok(gateFailures(jobs).length);
  }
  assert.ok(gateFailures({}).length);
});

test("gate CLI exits nonzero on failed, missing and malformed evidence", () => {
  const script = fileURLToPath(new URL("./check-gate.mjs", import.meta.url));
  for (const input of ["{}", "not json", JSON.stringify(evidence("true", "cancelled"))]) {
    assert.equal(spawnSync(process.execPath, [script], { input }).status, 1);
  }
  assert.equal(spawnSync(process.execPath, [script], { input: JSON.stringify(evidence()) }).status, 0);
});

test("scope skips only known docs and treats runtime/config/unknown paths conservatively", () => {
  assert.equal(needsSeededE2E(["docs/runbook.md", "AGENTS.md", ".agents/skills/release-preflight/SKILL.md"]), false);
  for (const path of ["src/app/page.tsx", "src/lib/scoring/pipeline.ts", "supabase/seed.sql", "api/outcomes-worker.py", "package-lock.json", "vercel.json", "next.config.ts", "playwright.config.ts", "tests/e2e/seeded/fixtures.ts", ".github/workflows/ci.yml", "scripts/release/check-gate.mjs", "new-runtime-config"]) {
    assert.equal(needsSeededE2E(["docs/runbook.md", path]), true, path);
  }
  assert.equal(needsSeededE2E([]), true);
});

test("scope includes deleted/renamed runtime paths and every file past 300", () => {
  const cwd = mkdtempSync(join(tmpdir(), "release-scope-"));
  const git = (...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  try {
    git("init"); git("config", "user.email", "fixture@example.invalid"); git("config", "user.name", "Fixture");
    mkdirSync(join(cwd, "src")); writeFileSync(join(cwd, "src", "old\nname.ts"), "fixture");
    git("add", "."); git("commit", "-m", "base"); const base = git("rev-parse", "HEAD");
    mkdirSync(join(cwd, "docs")); git("mv", "src/old\nname.ts", "docs/new.md");
    for (let index = 0; index < 310; index++) writeFileSync(join(cwd, "docs", `${index}.md`), "doc");
    git("add", "."); git("commit", "-m", "rename");
    const paths = changedPaths(base, "HEAD", cwd);
    assert.equal(paths.length, 312);
    assert.ok(paths.includes("src/old\nname.ts"));
    assert.equal(needsSeededE2E(paths), true);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("local runner refuses env files and inherited provider values without printing them", () => {
  const cwd = mkdtempSync(join(tmpdir(), "release-env-"));
  const script = fileURLToPath(new URL("./validate-local.mjs", import.meta.url));
  const env = { PATH: process.env.PATH };
  try {
    writeFileSync(join(cwd, ".env.local"), "NEXT_PUBLIC_SUPABASE_URL=fixture-private-value");
    let result = spawnSync(process.execPath, [script], { cwd, env, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.ok(!result.stdout.includes("Running"));
    assert.ok(!result.stderr.includes("fixture-private-value"));
    rmSync(join(cwd, ".env.local"));
    result = spawnSync(process.execPath, [script], { cwd, env: { ...env, STRIPE_SECRET_KEY: "fixture-private-value" }, encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.ok(!result.stdout.includes("Running"));
    assert.ok(!result.stderr.includes("fixture-private-value"));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("local runner stops on a failed check instead of claiming later checks ran", () => {
  const cwd = mkdtempSync(join(tmpdir(), "release-stop-"));
  const script = fileURLToPath(new URL("./validate-local.mjs", import.meta.url));
  try {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ scripts: { "test:release": "node -e 'process.exit(7)'" } }));
    const result = spawnSync(process.execPath, [script], { cwd, env: { PATH: process.env.PATH }, encoding: "utf8" });
    assert.equal(result.status, 7);
    assert.ok(result.stdout.includes("Running test:release"));
    assert.ok(!result.stdout.includes("Running lint"));
    assert.ok(result.stderr.includes("later checks were not run"));
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
