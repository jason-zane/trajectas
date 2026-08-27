/**
 * Architectural guard: chat tools must query through the REQUESTING USER'S
 * RLS-scoped Supabase client, never the service-role admin client.
 *
 * This is the load-bearing isolation guarantee of grounded chat. Tenancy is
 * enforced by the RLS policies attached to the caller's connection, which is
 * what lets one tool implementation serve a platform admin broadly and a
 * client member narrowly. A single tool reaching for createAdminClient()
 * silently bypasses every one of those policies — so the ban is pinned here
 * rather than left to review.
 *
 * src/lib/chat/audit.ts is the one allowed exception: it only ever INSERTs
 * into the append-only audit_events table and never reads.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CHAT_DIR = join(ROOT, "src", "lib", "chat");
/**
 * The chat entity lookups live in the DAL (per AGENTS.md), so the ban has to
 * follow them there — a chat-search query on the admin client would bypass RLS
 * just as surely as one inside src/lib/chat.
 */
const DAL_CHAT_FILES = [
  join(ROOT, "src", "lib", "dal", "chat-search.ts"),
  join(ROOT, "src", "lib", "dal", "chat-search-mappers.ts"),
];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

/** Files permitted to open the admin client, with the reason they may. */
const ALLOWLIST: Record<string, string> = {
  "src/lib/chat/audit.ts":
    "Write-only append to audit_events; never reads tenant data.",
};

const BANNED_PATTERNS: Array<{ regex: RegExp; rationale: string }> = [
  {
    regex: /from\s+['"]@\/lib\/supabase\/admin['"]/,
    rationale:
      "Chat tools must use createServerSupabaseClient() so RLS enforces tenancy.",
  },
  {
    regex: /\bcreateAdminClient\s*\(/,
    rationale:
      "Chat tools must not open a service-role client — it bypasses every RLS policy.",
  },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
      continue;
    }
    const dot = entry.lastIndexOf(".");
    if (dot >= 0 && SCAN_EXTENSIONS.has(entry.slice(dot))) out.push(full);
  }
  return out;
}

describe("chat tools query through the caller's RLS-scoped client", () => {
  const files = [...walk(CHAT_DIR), ...DAL_CHAT_FILES];

  it("scans a non-trivial number of chat modules", () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it("covers the chat DAL modules, where the queries actually live", () => {
    for (const file of DAL_CHAT_FILES) {
      expect(existsSync(file), `${file} is guarded but missing`).toBe(true);
    }
  });

  it.each(files.map((f) => [relative(ROOT, f), f]))(
    "%s does not open an admin client",
    (relPath, fullPath) => {
      const key = String(relPath).split("\\").join("/");
      if (ALLOWLIST[key]) return;

      const source = readFileSync(fullPath as string, "utf8");
      for (const { regex, rationale } of BANNED_PATTERNS) {
        expect(
          regex.test(source),
          `${key} matches ${regex} — ${rationale}`,
        ).toBe(false);
      }
    },
  );

  it("keeps the allowlist honest — every entry must still exist", () => {
    const scanned = new Set(
      files.map((f) => relative(ROOT, f).split("\\").join("/")),
    );
    for (const key of Object.keys(ALLOWLIST)) {
      expect(scanned.has(key), `${key} is allow-listed but was not found`).toBe(
        true,
      );
    }
  });
});
