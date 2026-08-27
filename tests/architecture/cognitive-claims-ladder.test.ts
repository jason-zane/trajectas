/**
 * Architectural guard for LR-11 / #341's claims ladder.
 *
 * src/lib/reports/cognitive-claims.ts is the ONLY module permitted to read
 * percentile / confidence_interval_* / theta off a raw participant_scores
 * row. Every report surface that displays a cognitive/ability score must go
 * through resolveCognitiveScoreDisplay() and render only the narrowed
 * CognitiveScoreDisplay union it returns — never the raw row.
 *
 * Three independent guards, because each catches a different regression:
 *
 *  1. RUNTIME — a corrupted row (stray non-null percentile/CI values with no
 *     norm group) proves the leak is structurally impossible: the resolved
 *     UncalibratedCognitiveScore object literally has no slot for those
 *     values to land in, because resolveCognitiveScoreDisplay builds its
 *     return value field-by-field rather than spreading the row.
 *  2. COMPILE-TIME — @ts-expect-error on reading `.percentile` off a
 *     narrowed 'uncalibrated' value. This only continues to typecheck clean
 *     while UncalibratedCognitiveScore has no percentile field, so
 *     `npx tsc --noEmit` itself enforces the guard on every future edit —
 *     if someone adds a percentile field to that type, this test file fails
 *     to compile (unused ts-expect-error).
 *  3. STATIC SCAN — no file under src/lib/reports/** or
 *     src/components/reports/** other than cognitive-claims.ts itself (the
 *     sanctioned raw-row reader) may reference the raw snake_case column
 *     names. cognitive-profile.tsx is allowlisted for the single word
 *     `percentile` only — it legitimately reads the RESOLVED
 *     CalibratedCognitiveScore.percentile field (camelCase-identical to the
 *     raw column name), never the raw row.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveCognitiveScoreDisplay,
  CognitiveClaimsViolation,
  type RawCognitiveScoreRow,
  type CognitiveScoreDisplay,
} from "@/lib/reports/cognitive-claims";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

// ---------------------------------------------------------------------------
// 1. Runtime — corrupted-row leak test
// ---------------------------------------------------------------------------

function baseRow(overrides: Partial<RawCognitiveScoreRow> = {}): RawCognitiveScoreRow {
  return {
    metric: "percent_correct",
    scaled_score: 67.9,
    raw_correct: 19,
    items_used: 28,
    items_attempted: 26,
    theta: null,
    theta_se: null,
    norm_group_id: null,
    norm_version: null,
    percentile: null,
    confidence_interval_lower: null,
    confidence_interval_upper: null,
    provisional: true,
    scoring_variant: "sum_correct",
    ...overrides,
  };
}

describe("resolveCognitiveScoreDisplay — the claims ladder", () => {
  it("a corrupted uncalibrated row (stray percentile/CI, no norm group) cannot leak them", () => {
    const corrupted = baseRow({
      // No norm group, so this MUST resolve to 'uncalibrated' — but a bug,
      // a hand-edited row, or a future migration that loosens the DB CHECK
      // could leave stray non-null values sitting in these columns anyway.
      percentile: 91,
      confidence_interval_lower: 85,
      confidence_interval_upper: 97,
    });

    const result = resolveCognitiveScoreDisplay(corrupted);

    expect(result.kind).toBe("uncalibrated");
    // The leak-is-impossible claim: these keys must not exist on the
    // returned object at all, not just be null/undefined.
    expect(Object.prototype.hasOwnProperty.call(result, "percentile")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, "confidenceIntervalLower")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, "confidenceIntervalUpper")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, "tScore")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(result, "normGroupId")).toBe(false);
    expect(JSON.stringify(result)).not.toMatch(/91|85|97/);
  });

  it("returns a calibrated score only when a versioned norm group backs a t_score row", () => {
    const calibrated = baseRow({
      metric: "t_score",
      norm_group_id: "11111111-1111-1111-1111-111111111111",
      norm_version: "2026.1",
      percentile: 72,
      confidence_interval_lower: 62,
      confidence_interval_upper: 82,
      provisional: false,
    });

    const result = resolveCognitiveScoreDisplay(calibrated);
    expect(result).toEqual({
      kind: "calibrated",
      provisional: false,
      tScore: 67.9,
      percentile: 72,
      confidenceIntervalLower: 62,
      confidenceIntervalUpper: 82,
      normGroupId: "11111111-1111-1111-1111-111111111111",
      normVersion: "2026.1",
    });
  });

  it("throws rather than guess when a norm group is present but metric isn't t_score", () => {
    const inconsistent = baseRow({
      metric: "percent_correct",
      norm_group_id: "11111111-1111-1111-1111-111111111111",
      norm_version: "2026.1",
    });
    expect(() => resolveCognitiveScoreDisplay(inconsistent)).toThrow(CognitiveClaimsViolation);
  });

  it("throws rather than render a partial calibrated score (norm group but missing percentile/CI)", () => {
    const partial = baseRow({
      metric: "t_score",
      norm_group_id: "11111111-1111-1111-1111-111111111111",
      norm_version: "2026.1",
      percentile: null,
    });
    expect(() => resolveCognitiveScoreDisplay(partial)).toThrow(CognitiveClaimsViolation);
  });

  it("throws rather than render a 'final' score with no norm group backing it", () => {
    const impossible = baseRow({ provisional: false });
    expect(() => resolveCognitiveScoreDisplay(impossible)).toThrow(CognitiveClaimsViolation);
  });

  it("a norm_group_id without a norm_version is not a versioned norm group — falls back to uncalibrated, never throws a false calibration", () => {
    // Mirrors participant_scores_norm_group_requires_version: this shape
    // should be unreachable in the DB, but the resolver must not treat a
    // dangling norm_group_id as "calibrated" if it somehow occurs.
    const dangling = baseRow({ norm_group_id: "11111111-1111-1111-1111-111111111111", norm_version: null });
    const result = resolveCognitiveScoreDisplay(dangling);
    expect(result.kind).toBe("uncalibrated");
  });
});

// ---------------------------------------------------------------------------
// 2. Compile-time — @ts-expect-error pin
// ---------------------------------------------------------------------------

describe("CognitiveScoreDisplay — compile-time narrowing", () => {
  it("an uncalibrated value has no percentile field to read (enforced by npx tsc --noEmit)", () => {
    const display: CognitiveScoreDisplay = resolveCognitiveScoreDisplay(baseRow());
    expect(display.kind).toBe("uncalibrated");
    if (display.kind === "uncalibrated") {
      // @ts-expect-error — UncalibratedCognitiveScore has no percentile
      // field. If this stops erroring, the guard has been weakened and
      // `npx tsc --noEmit` will fail on this file (unused ts-expect-error).
      const leaked = display.percentile;
      expect(leaked).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Static scan — no report path reads the raw columns directly
// ---------------------------------------------------------------------------

const SCAN_ROOTS = [
  join(ROOT, "src", "lib", "reports"),
  join(ROOT, "src", "components", "reports"),
];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx"]);

/**
 * cognitive-claims.ts is the sanctioned raw-row reader/writer — exempt from
 * every pattern below.
 *
 * competency-claims.ts is the sanctioned raw-row reader for the OTHER half of
 * the ladder (metric='pomp'). It is the exact peer of cognitive-claims.ts —
 * same fail-closed structure, same field-by-field construction, its own
 * architecture test — and between them they cover every metric
 * participant_scores_metric_check allows. It must read the raw columns for the
 * same reason cognitive-claims.ts does: something has to be the boundary.
 *
 * cognitive-profile.tsx is the sanctioned RESOLVED-value renderer — exempt
 * from the `percentile` pattern only, because CalibratedCognitiveScore's
 * field is (deliberately) named identically to the raw column. It gets no
 * exemption from the other patterns: every other ladder field was renamed
 * camelCase on the resolved type (confidenceIntervalLower, normGroupId, …),
 * so this component never has a legitimate reason to reference the raw
 * snake_case names.
 */
const FULLY_EXEMPT = new Set([
  join(ROOT, "src", "lib", "reports", "cognitive-claims.ts"),
  join(ROOT, "src", "lib", "reports", "competency-claims.ts"),
]);
const PERCENTILE_EXEMPT = new Set([
  join(ROOT, "src", "lib", "reports", "cognitive-claims.ts"),
  join(ROOT, "src", "lib", "reports", "competency-claims.ts"),
  join(ROOT, "src", "components", "reports", "blocks", "cognitive-profile.tsx"),
]);

const RAW_COLUMN_PATTERNS: Array<{ regex: RegExp; rationale: string }> = [
  { regex: /\bconfidence_interval_lower\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s confidenceIntervalLower" },
  { regex: /\bconfidence_interval_upper\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s confidenceIntervalUpper" },
  { regex: /\bnorm_group_id\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s normGroupId" },
  { regex: /\bnorm_version\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s normVersion" },
  { regex: /\braw_correct\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s rawCorrect" },
  { regex: /\bitems_used\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s itemsUsed" },
  { regex: /\bitems_attempted\b/, rationale: "Raw column — use resolveCognitiveScoreDisplay()'s itemsAttempted" },
  { regex: /\btheta_se\b/, rationale: "Raw column — never exposed on CognitiveScoreDisplay at all" },
  { regex: /\btheta\b/, rationale: "Raw column — never exposed on CognitiveScoreDisplay at all" },
];
const PERCENTILE_PATTERN = { regex: /\bpercentile\b/, rationale: "Ambiguous with the resolved field of the same name — only cognitive-claims.ts and cognitive-profile.tsx may reference it" };

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

describe("no report path reads the claims-ladder columns directly", () => {
  const files = SCAN_ROOTS.flatMap((root) => walk(root));

  it("scanned at least one file in each root (the guard cannot pass vacuously)", () => {
    for (const root of SCAN_ROOTS) {
      const inRoot = files.filter((f) => f.startsWith(root));
      expect(inRoot.length).toBeGreaterThan(0);
    }
    expect(files.length).toBeGreaterThan(10);
  });

  it("no file outside cognitive-claims.ts references the raw snake_case ladder columns", () => {
    const violations: Array<{ file: string; line: number; rationale: string }> = [];

    for (const file of files) {
      if (FULLY_EXEMPT.has(file)) continue;
      const lines = readFileSync(file, "utf8").split("\n");
      const patterns = PERCENTILE_EXEMPT.has(file)
        ? RAW_COLUMN_PATTERNS
        : [...RAW_COLUMN_PATTERNS, PERCENTILE_PATTERN];

      for (const { regex, rationale } of patterns) {
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
        `Found ${violations.length} direct read(s) of a claims-ladder column outside cognitive-claims.ts.\n\n${message}\n\n` +
          `Route through resolveCognitiveScoreDisplay() in src/lib/reports/cognitive-claims.ts instead.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
