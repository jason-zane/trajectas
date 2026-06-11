/**
 * Architectural guard for the auth hot path.
 *
 * `supabase.auth.getUser()` makes a network round trip to the Supabase Auth
 * server on every call. The 2026-06 performance audit found it accounted for
 * ~40% of all platform round trips (76K calls / 78 days) because it ran in
 * the proxy AND in actor resolution on every request.
 *
 * The hot path now uses `getVerifiedUserId()` (src/lib/auth/claims.ts),
 * which verifies the session JWT locally against the project's JWKS —
 * zero network. `getUser()` remains correct ONLY at true auth boundaries
 * where server-side revocation freshness matters more than latency:
 *
 *   - the sign-in callback (fresh session, invite finalization)
 *   - destructive account actions (deletion request/cancel)
 *
 * If this test fails, do not extend the allowlist by default — use
 * `getVerifiedUserId()` unless the call site genuinely needs the Auth
 * server's live view of the user (bans/deletions take effect mid-session).
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = join(repoRoot, "src");

const ALLOWED_GET_USER_FILES = new Set([
  "src/app/auth/callback/route.ts",
  "src/app/actions/account-deletion.ts",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("auth hot path", () => {
  it("only allowlisted auth boundaries call auth.getUser()", () => {
    const offenders: string[] = [];

    for (const file of walk(srcRoot)) {
      const rel = relative(repoRoot, file);
      if (ALLOWED_GET_USER_FILES.has(rel)) continue;
      const content = readFileSync(file, "utf8");
      if (content.includes(".auth.getUser(")) {
        offenders.push(rel);
      }
    }

    expect(
      offenders,
      `auth.getUser() found outside the allowlist. Use getVerifiedUserId() ` +
        `from @/lib/auth/claims (local JWT verification) instead, or discuss ` +
        `extending the allowlist if revocation freshness is genuinely required.`
    ).toEqual([]);
  });

  it("the allowlisted files still exist and still call getUser (keep the list honest)", () => {
    for (const rel of ALLOWED_GET_USER_FILES) {
      const content = readFileSync(join(repoRoot, rel), "utf8");
      expect(content, `${rel} no longer calls auth.getUser() — prune the allowlist`).toContain(
        ".auth.getUser("
      );
    }
  });
});
