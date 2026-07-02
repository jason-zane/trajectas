/**
 * Architectural guard: option values must never be derived from likert
 * anchors by hand.
 *
 * Anchors are stored as either a 1-keyed record or (historically) a plain
 * array. `Object.entries()` over the array shape yields 0-based indices as
 * option values against 1-based scoring bounds — the off-by-one that
 * mis-scored every production response until PR #305. All derivation must go
 * through `likertAnchorOptions` / `normalizeLikertAnchors` in
 * src/lib/assess/likert-anchors.ts.
 *
 * This test flags any src file that both touches `.anchors` and calls
 * `Object.entries` outside the allowlisted helper and its editor UI.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SRC = join(ROOT, "src");
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

// The helper itself, plus the response-format editor whose local form state
// legitimately reshapes anchors for editing (it persists via the helper).
const ALLOWLIST = new Set([
  "src/lib/assess/likert-anchors.ts",
  "src/app/(dashboard)/response-formats/response-format-form.tsx",
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXTENSIONS.has(full.slice(full.lastIndexOf(".")))) {
      out.push(full);
    }
  }
  return out;
}

describe("architecture: likert anchor derivation goes through the helper", () => {
  it("no src file hand-rolls Object.entries over anchors", () => {
    const offenders: string[] = [];

    for (const file of walk(SRC)) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      if (ALLOWLIST.has(rel)) continue;

      const content = readFileSync(file, "utf8");
      if (!content.includes(".anchors") && !content.includes("anchors ")) continue;
      if (!/Object\.entries\s*\(\s*[^)]*anchors/i.test(content)) continue;

      offenders.push(rel);
    }

    expect(
      offenders,
      `These files derive option values from anchors by hand instead of using ` +
        `likertAnchorOptions (src/lib/assess/likert-anchors.ts):\n  ${offenders.join("\n  ")}`,
    ).toEqual([]);
  });
});
