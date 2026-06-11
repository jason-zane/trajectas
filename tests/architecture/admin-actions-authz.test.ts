/**
 * Architectural guard: any exported Server Action that opens the *admin*
 * Supabase client (`createAdminClient`, service role — which BYPASSES RLS and
 * tenant isolation) must also perform an authorization check. An admin-client
 * action without an auth gate is a cross-tenant data hole.
 *
 * This is intentionally scoped to the admin client (the dangerous path).
 * Actions that use the RLS-scoped server client are protected by RLS.
 *
 * If a flagged function is a genuine exception (e.g. a pure helper that happens
 * to live in an actions file, or one gated by a token validated by its caller),
 * add it to ALLOWLIST with a one-line reason.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const ACTIONS_DIR = join(ROOT, "src", "app", "actions");

const AUTH_PATTERNS = [
  // require<Something>() / require360Admin() helpers (incl. digits).
  /\brequire[A-Za-z0-9]\w*\s*\(/,
  // assert<Something>() guards — assertCanManageCampaigns, assertSessionAccess, …
  /\bassert[A-Z]\w*\s*\(/,
  /resolveAuthorizedScope\s*\(/,
  /resolveSessionActor\s*\(/,
  /getValidatedSupportSession\s*\(/,
  /verify\w*Token\s*\(/,
  // Self-service: the action operates on the currently authenticated user.
  /\.auth\.getUser\s*\(/,
  // Local-JWT equivalent of getUser (see src/lib/auth/claims.ts).
  /getVerifiedUserId\s*\(/,
  /getCurrentProfile\s*\(/,
  /getAuthenticatedActor\s*\(/,
  // Participant token-gated actions take a `token` parameter that they validate.
  /\btoken:\s*string/,
];

// `${relativePath}#${functionName}` -> reason. Vetted exceptions only.
const ALLOWLIST = new Map<string, string>([
  [
    "src/app/actions/account-deletion.ts#requestAccountDeletion",
    "Self-service: gated on the caller's own session userId (deletes own account).",
  ],
  [
    "src/app/actions/assess.ts#registerViaLink",
    "Participant self-registration; authorised by the campaign invite link token (linkToken).",
  ],
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    if (entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

interface Fn {
  name: string;
  body: string;
}

/**
 * Split a file into exported-async-function chunks (name + body to next export).
 * Matches both `export async function name` and
 * `export const name = async (...) =>` (arrow Server Actions).
 */
function exportedAsyncFunctions(text: string): Fn[] {
  const re =
    /export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*(?::[^=]+)?=\s*async\b)/g;
  const marks: Array<{ name: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    marks.push({ name: m[1] ?? m[2], index: m.index });
  }

  return marks.map((mark, i) => {
    const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
    return { name: mark.name, body: text.slice(mark.index, end) };
  });
}

describe("admin-client actions are authorization-gated", () => {
  it("every action using createAdminClient performs an auth check", () => {
    const violations: string[] = [];

    for (const file of walk(ACTIONS_DIR)) {
      const rel = file.replace(`${ROOT}/`, "");
      const text = readFileSync(file, "utf8");

      for (const fn of exportedAsyncFunctions(text)) {
        if (!/createAdminClient\s*\(/.test(fn.body)) continue;
        // Only enforce on MUTATIONS — an admin-client write that isn't auth-gated
        // is a cross-tenant hole. Reads of reference/platform data are lower risk
        // and use too many access patterns to statically enforce. `.rpc(` is
        // included since an action can write through a service-role RPC.
        if (!/\.(insert|update|delete|upsert|rpc)\s*\(/.test(fn.body)) continue;
        const gated = AUTH_PATTERNS.some((re) => re.test(fn.body));
        if (gated) continue;
        if (ALLOWLIST.has(`${rel}#${fn.name}`)) continue;
        violations.push(`${rel}#${fn.name}`);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `These Server Actions open the admin (service-role) client but have no auth gate:\n` +
          violations.map((v) => `  ${v}`).join("\n") +
          `\n\ncreateAdminClient bypasses RLS, so each must call a require*Access / require*Scope\n` +
          `/ resolveAuthorizedScope check. If a flagged function is a vetted exception, add it to\n` +
          `ALLOWLIST in this test with a reason.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
