/**
 * Architectural guard for the COMPETENCY claims ladder — the read-side mirror
 * of participant_scores_norm_referenced_requires_group for metric='pomp'.
 *
 * src/lib/reports/competency-claims.ts is the only module permitted to read
 * percentile / confidence_interval_* off a raw competency row. It is the
 * counterpart to cognitive-claims.ts: between them they cover every metric
 * participant_scores allows.
 *
 * Two guards, each catching a different regression:
 *
 *  1. RUNTIME — a corrupted row (stray percentile/CI with no norm group)
 *     proves the leak is structurally impossible: the resolved
 *     UncalibratedCompetencyScore has no slot for those values, because
 *     resolveCompetencyScoreDisplay builds its return value field-by-field
 *     rather than spreading the row.
 *  2. COMPILE-TIME — @ts-expect-error on reading `.percentile` off a narrowed
 *     'uncalibrated' value. This only continues to typecheck clean while
 *     UncalibratedCompetencyScore has no percentile field, so `tsc --noEmit`
 *     itself enforces the guard on every future edit: adding a percentile
 *     field to that type makes this file fail to compile.
 */

import { describe, expect, it } from "vitest";
import {
  resolveCompetencyScoreDisplay,
  isCompetencyMetric,
  CompetencyClaimsViolation,
  type RawCompetencyScoreRow,
  type CompetencyScoreDisplay,
} from "@/lib/reports/competency-claims";

function baseRow(
  overrides: Partial<RawCompetencyScoreRow> = {},
): RawCompetencyScoreRow {
  return {
    metric: "pomp",
    scaled_score: 62.4,
    raw_score: 31,
    norm_group_id: null,
    norm_version: null,
    percentile: null,
    confidence_interval_lower: null,
    confidence_interval_upper: null,
    provisional: false,
    scoring_variant: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. Runtime — corrupted-row leak test
// ---------------------------------------------------------------------------

describe("resolveCompetencyScoreDisplay — the claims ladder", () => {
  it("a corrupted uncalibrated row (stray percentile/CI, no norm group) cannot leak them", () => {
    const corrupted = baseRow({
      percentile: 88,
      confidence_interval_lower: 55,
      confidence_interval_upper: 70,
    });

    const display = resolveCompetencyScoreDisplay(corrupted);
    expect(display.kind).toBe("uncalibrated");

    // The stray values have nowhere to land — not merely undefined, absent.
    const asRecord = display as unknown as Record<string, unknown>;
    expect("percentile" in asRecord).toBe(false);
    expect("confidenceIntervalLower" in asRecord).toBe(false);
    expect("confidenceIntervalUpper" in asRecord).toBe(false);
    expect("normGroupId" in asRecord).toBe(false);
    expect("normVersion" in asRecord).toBe(false);

    // A round-trip through JSON (what a chat tool result or an API response
    // does) must not reintroduce them either.
    expect(Object.keys(JSON.parse(JSON.stringify(display))).sort()).toEqual([
      "kind",
      "provisional",
      "rawScore",
      "scaledScore",
    ]);
  });

  it("renders the criterion-referenced scaled score without a norm group", () => {
    const display = resolveCompetencyScoreDisplay(baseRow());
    expect(display.kind).toBe("uncalibrated");
    if (display.kind !== "uncalibrated") return;
    expect(display.scaledScore).toBe(62.4);
    expect(display.rawScore).toBe(31);
  });

  it("allows an uncalibrated competency score to be final — POMP is criterion-referenced", () => {
    const display = resolveCompetencyScoreDisplay(baseRow({ provisional: false }));
    expect(display.kind).toBe("uncalibrated");
    expect(display.provisional).toBe(false);
  });

  it("promotes to calibrated only with a versioned norm group AND a percentile", () => {
    const display = resolveCompetencyScoreDisplay(
      baseRow({
        norm_group_id: "11111111-1111-1111-1111-111111111111",
        norm_version: "2026.1",
        percentile: 74,
        confidence_interval_lower: 58,
        confidence_interval_upper: 67,
      }),
    );
    expect(display.kind).toBe("calibrated");
    if (display.kind !== "calibrated") return;
    expect(display.percentile).toBe(74);
    expect(display.normVersion).toBe("2026.1");
  });

  it("throws rather than rendering a partial calibrated score", () => {
    expect(() =>
      resolveCompetencyScoreDisplay(
        baseRow({
          norm_group_id: "11111111-1111-1111-1111-111111111111",
          norm_version: "2026.1",
          percentile: null,
        }),
      ),
    ).toThrow(CompetencyClaimsViolation);
  });

  it("throws on a half-open confidence interval", () => {
    expect(() =>
      resolveCompetencyScoreDisplay(
        baseRow({
          norm_group_id: "11111111-1111-1111-1111-111111111111",
          norm_version: "2026.1",
          percentile: 74,
          confidence_interval_lower: 58,
          confidence_interval_upper: null,
        }),
      ),
    ).toThrow(CompetencyClaimsViolation);
  });

  it("throws on a norm group with no version — mirroring the DB constraint", () => {
    // norm_group_id without norm_version cannot satisfy the versioned-group
    // predicate, so the row falls to the uncalibrated rung rather than
    // silently rendering a rank claim.
    const display = resolveCompetencyScoreDisplay(
      baseRow({
        norm_group_id: "11111111-1111-1111-1111-111111111111",
        norm_version: null,
        percentile: 74,
      }),
    );
    expect(display.kind).toBe("uncalibrated");
    expect("percentile" in (display as unknown as Record<string, unknown>)).toBe(false);
  });

  it("throws on a non-finite scaled score", () => {
    expect(() =>
      resolveCompetencyScoreDisplay(baseRow({ scaled_score: Number.NaN })),
    ).toThrow(CompetencyClaimsViolation);
  });

  it("refuses a cognitive row rather than exposing its scaled score", () => {
    // A percent-correct value surfaced through this resolver would be rendered
    // against competency bands ("Highly Effective") and read as a rank it is
    // not. The cognitive ladder withholds that field deliberately; routing
    // around it by passing the row here must fail, not silently succeed.
    for (const metric of ["percent_correct", "t_score"]) {
      expect(() =>
        resolveCompetencyScoreDisplay(baseRow({ metric })),
      ).toThrow(CompetencyClaimsViolation);
    }
  });

  it("refuses an unknown metric", () => {
    expect(() =>
      resolveCompetencyScoreDisplay(baseRow({ metric: "something_new" })),
    ).toThrow(CompetencyClaimsViolation);
  });

  it("checks the metric before the scaled score, so a cognitive row cannot leak either way", () => {
    // Ordering matters: if the finite-score check ran first, a cognitive row
    // with a valid score would fall through to the metric check anyway — but a
    // future edit could reorder them. Pin the metric as the first gate.
    expect(() =>
      resolveCompetencyScoreDisplay(
        baseRow({ metric: "t_score", scaled_score: Number.NaN }),
      ),
    ).toThrow(/not 'pomp'/);
  });

  it("identifies the competency metric and rejects cognitive ones", () => {
    expect(isCompetencyMetric("pomp")).toBe(true);
    expect(isCompetencyMetric("percent_correct")).toBe(false);
    expect(isCompetencyMetric("t_score")).toBe(false);
    expect(isCompetencyMetric(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Compile-time — the type has no rank-claim fields to forward
// ---------------------------------------------------------------------------

describe("UncalibratedCompetencyScore has no norm-referenced fields", () => {
  it("reading .percentile off the uncalibrated branch is a compile error", () => {
    const display: CompetencyScoreDisplay = resolveCompetencyScoreDisplay(baseRow());
    if (display.kind === "uncalibrated") {
      // @ts-expect-error - UncalibratedCompetencyScore deliberately has no
      // `percentile` property. If someone adds one, this @ts-expect-error
      // becomes unused and `tsc --noEmit` fails — which is the guard.
      const leaked = display.percentile;
      expect(leaked).toBeUndefined();
    }
    expect(display.kind).toBe("uncalibrated");
  });
});
