/**
 * Architectural guard: every integration test that can open a REAL Supabase
 * connection must gate on the local-host check, so it can never run against
 * production (`.env.local` points at prod). This is the recurrence guard for
 * the prod-write footgun fixed in the integration-test-hardening work.
 *
 * A file "opens a real client" if it imports `@supabase/supabase-js` directly,
 * or imports the shared RLS fixture (which centralises the guard). Files that
 * mock the Supabase client or never connect are exempt automatically.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INTEGRATION_DIR = join(ROOT, "tests", "integration");

const OPENS_REAL_DB = [
  /from\s+['"]@supabase\/supabase-js['"]/,
  /_helpers\/rls-fixture/,
];

// The guard must be APPLIED, not just defined: the suite gates execution on the
// host check via `describe.skipIf(!canRun)` (canRun incorporates isLocalSupabase,
// whether inline or from the shared rls-fixture) or `skipIf(!isLocalSupabase)`.
const GUARD_APPLIED = /skipIf\(\s*!\s*(canRun|isLocalSupabase)\b/;

function walkTestFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walkTestFiles(full, out);
      continue;
    }
    if (entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("integration tests are guarded against running on production", () => {
  it("every integration test that opens a real DB connection applies the host guard", () => {
    const violations: string[] = [];

    for (const file of walkTestFiles(INTEGRATION_DIR)) {
      const text = readFileSync(file, "utf8");

      const opensRealDb = OPENS_REAL_DB.some((re) => re.test(text));
      if (!opensRealDb) continue;

      if (!GUARD_APPLIED.test(text)) violations.push(file.replace(`${ROOT}/`, ""));
    }

    if (violations.length > 0) {
      throw new Error(
        `These integration tests open a real Supabase client but do not apply the local-host guard:\n` +
          violations.map((v) => `  ${v}`).join("\n") +
          `\n\nImport the shared fixture (tests/integration/_helpers/rls-fixture.ts) for the\n` +
          `guarded \`canRun\`, or add the isLocalSupabase check from AGENTS.md. Otherwise the\n` +
          `test can write to production when run via \`npm test\` (.env.local points at prod).`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
