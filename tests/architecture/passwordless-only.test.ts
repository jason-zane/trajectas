/**
 * Architectural regression guard for our passwordless-only auth posture.
 *
 * Trajectas is OTP-only — users sign in by receiving a code at their email
 * address. Passwords are never set, never collected, never reset. The
 * Supabase password grant endpoint (`POST /auth/v1/token?grant_type=password`)
 * still exists because Supabase does not let us disable it at the project
 * level, but no client code in this repo may call it.
 *
 * This test scans the source tree for calls into Supabase's password APIs
 * and fails CI if any appear. If you are seeing this fail, do NOT add an
 * exception — talk to the team. The default is: if you need to authenticate
 * a user, use `signInWithOtp` / `verifyOtp`.
 *
 * Why this matters beyond convention: as long as a single user has a
 * `encrypted_password` set on `auth.users`, an attacker who guesses or
 * leaks that password can sign in via the grant_type=password endpoint
 * regardless of what our UI does. Migration `clear_user_passwords_and_disable_resets.sql`
 * nulls existing hashes; this test prevents new code from setting any.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);

/**
 * Each banned identifier corresponds to a Supabase Auth method that takes
 * or sets a password. The patterns intentionally include the method name
 * with a `(` to avoid matching unrelated identifiers in strings or comments.
 */
const BANNED_PATTERNS: Array<{ regex: RegExp; rationale: string }> = [
  {
    regex: /\bsignInWithPassword\s*\(/,
    rationale: "Use signInWithOtp + verifyOtp instead",
  },
  {
    regex: /\bresetPasswordForEmail\s*\(/,
    rationale: "No password to reset; use signInWithOtp",
  },
  {
    regex: /\bupdateUser\s*\(\s*\{[^}]*\bpassword\s*:/,
    rationale: "Never set passwords on auth.users",
  },
  {
    regex: /\.admin\s*\.\s*createUser\s*\(\s*\{[^}]*\bpassword\s*:/,
    rationale: "admin.createUser must not pass a password",
  },
  {
    regex: /\.admin\s*\.\s*updateUserById\s*\([^)]*\bpassword\s*:/,
    rationale: "admin.updateUserById must not set a password",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, out);
      continue;
    }
    const dot = entry.lastIndexOf(".");
    if (dot < 0) continue;
    if (SCAN_EXTENSIONS.has(entry.slice(dot))) out.push(full);
  }
  return out;
}

describe("passwordless-only auth", () => {
  it("contains no calls to Supabase password APIs in src/", () => {
    const violations: Array<{ file: string; line: number; pattern: string; rationale: string }> = [];

    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");

      for (const { regex, rationale } of BANNED_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            violations.push({
              file: file.replace(`${ROOT}/`, ""),
              line: i + 1,
              pattern: regex.source,
              rationale,
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const message = violations
        .map((v) => `  ${v.file}:${v.line}  →  ${v.pattern}\n    ${v.rationale}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} forbidden password-API call(s). Trajectas is OTP-only.\n\n${message}\n\nSee tests/architecture/passwordless-only.test.ts for context.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
