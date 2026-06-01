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
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const INTEGRATION_DIR = join(ROOT, "tests", "integration");

const OPENS_REAL_DB = [
  /from\s+['"]@supabase\/supabase-js['"]/,
  /_helpers\/rls-fixture/,
];

// The shared rls-fixture exports the guarded `canRun`; an inline guard uses
// `isLocalSupabase`. Either satisfies the requirement.
const HAS_GUARD = [/\bisLocalSupabase\b/, /_helpers\/rls-fixture/];

describe("integration tests are guarded against running on production", () => {
  it("every integration test that opens a real DB connection has the host guard", () => {
    const violations: string[] = [];

    for (const entry of readdirSync(INTEGRATION_DIR)) {
      if (!entry.endsWith(".test.ts")) continue;
      const text = readFileSync(join(INTEGRATION_DIR, entry), "utf8");

      const opensRealDb = OPENS_REAL_DB.some((re) => re.test(text));
      if (!opensRealDb) continue;

      const hasGuard = HAS_GUARD.some((re) => re.test(text));
      if (!hasGuard) violations.push(entry);
    }

    if (violations.length > 0) {
      throw new Error(
        `These integration tests open a real Supabase client but lack the local-host guard:\n` +
          violations.map((v) => `  tests/integration/${v}`).join("\n") +
          `\n\nImport the shared fixture (tests/integration/_helpers/rls-fixture.ts) for the\n` +
          `guarded \`canRun\`, or add the isLocalSupabase check from AGENTS.md. Otherwise the\n` +
          `test can write to production when run via \`npm test\` (.env.local points at prod).`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
