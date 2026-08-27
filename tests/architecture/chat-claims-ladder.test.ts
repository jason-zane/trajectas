/**
 * Architectural guard: no chat surface reads a raw claims-ladder column.
 *
 * The report layer has this guard already (cognitive-claims-ladder.test.ts,
 * which scans src/lib/reports and src/components/reports). Chat is a second,
 * independent consumer of participant_scores, so it needs its own — otherwise
 * a chat tool could read `percentile` straight off a row and render a rank
 * claim for a score that has no norm group behind it.
 *
 * src/lib/dal/chat-scores.ts and its mapper are the sanctioned readers: the
 * DAL selects the columns and hands them to a resolver, and the mapper builds
 * its DTO from the RESOLVED union. Everything else — every tool, every card,
 * the run loop — must work from the narrowed shape.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCAN_ROOTS = [
  join(ROOT, "src", "lib", "chat"),
  join(ROOT, "src", "components", "chat"),
];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * The DAL boundary: chat-scores.ts issues the select and immediately routes
 * each row through resolveCompetencyScoreDisplay; chat-scores-mappers.ts maps
 * from the resolved union. Something has to name the columns to fetch them —
 * these two are that place, and nothing else may be.
 */
const EXEMPT = new Set([
  join(ROOT, "src", "lib", "dal", "chat-scores.ts"),
  join(ROOT, "src", "lib", "dal", "chat-scores-mappers.ts"),
]);

const RAW_COLUMN_PATTERNS: Array<{ regex: RegExp; rationale: string }> = [
  { regex: /\bconfidence_interval_lower\b/, rationale: "Raw column — use the resolved confidenceIntervalLower" },
  { regex: /\bconfidence_interval_upper\b/, rationale: "Raw column — use the resolved confidenceIntervalUpper" },
  { regex: /\bnorm_group_id\b/, rationale: "Raw column — the resolved shape exposes normVersion only when calibrated" },
  { regex: /\bnorm_version\b/, rationale: "Raw column — use the resolved normVersion" },
  { regex: /\bscaled_score\b/, rationale: "Raw column — use the resolved scaledScore" },
  { regex: /\braw_correct\b/, rationale: "Raw cognitive column — not rendered by chat at all" },
  { regex: /\btheta\b/, rationale: "Raw cognitive column — not rendered by chat at all" },
];

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
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

describe("no chat surface reads a raw claims-ladder column", () => {
  const files = SCAN_ROOTS.flatMap((root) => walk(root)).filter(
    (f) => !EXEMPT.has(f),
  );

  it("scans a non-trivial number of chat files (the guard cannot pass vacuously)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("the sanctioned DAL readers exist", () => {
    for (const file of EXEMPT) {
      expect(existsSync(file), `${file} is exempt but missing`).toBe(true);
    }
  });

  it("finds no direct raw-column reads", () => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");
      for (const { regex, rationale } of RAW_COLUMN_PATTERNS) {
        lines.forEach((line, i) => {
          if (regex.test(line)) {
            violations.push(
              `  ${relative(ROOT, file)}:${i + 1}  →  ${rationale}`,
            );
          }
        });
      }
    }
    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} raw claims-ladder column read(s) in chat.\n\n` +
          `${violations.join("\n")}\n\n` +
          `Route through resolveCompetencyScoreDisplay() via src/lib/dal/chat-scores.ts.`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
