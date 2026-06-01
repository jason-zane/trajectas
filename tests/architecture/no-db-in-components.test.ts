/**
 * Architectural guard: reusable components must not open a database client.
 *
 * A component in src/components/** must receive data as props or call a
 * server-only Data Access Layer function (src/lib/dal). It must never import or
 * create the admin/server Supabase client directly — that scatters data access
 * and authorization, and risks bundling server-only code (and secrets) toward
 * the client. See src/lib/dal/README.md.
 *
 * Pages (src/app/**) are the composition root and are intentionally NOT scanned
 * here (they may fetch, ideally via the DAL).
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const COMPONENTS = join(ROOT, "src", "components");
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

const BANNED_PATTERNS: Array<{ regex: RegExp; rationale: string }> = [
  {
    regex: /from\s+['"]@\/lib\/supabase\/admin['"]/,
    rationale: "Fetch via a DAL function (src/lib/dal), not the admin client.",
  },
  {
    regex: /from\s+['"]@\/lib\/supabase\/server['"]/,
    rationale: "Fetch via a DAL function (src/lib/dal), not the server client.",
  },
  {
    regex: /\bcreateAdminClient\s*\(/,
    rationale: "Components must not create an admin DB client.",
  },
  {
    regex: /\bcreateServerSupabaseClient\s*\(/,
    rationale: "Components must not create a server DB client.",
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

describe("no DB access in reusable components", () => {
  it("src/components/** does not open a database client", () => {
    const violations: Array<{ file: string; line: number; rationale: string }> = [];

    for (const file of walk(COMPONENTS)) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (const { regex, rationale } of BANNED_PATTERNS) {
        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            violations.push({ file: file.replace(`${ROOT}/`, ""), line: i + 1, rationale });
          }
        }
      }
    }

    if (violations.length > 0) {
      const message = violations
        .map((v) => `  ${v.file}:${v.line}  →  ${v.rationale}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} component(s) opening a DB client directly.\n\n${message}\n\n` +
          `Move the query into a server-only DAL function (src/lib/dal) and pass data as props.\n` +
          `See src/lib/dal/README.md.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
