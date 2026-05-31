import { describe, expect, it } from "vitest";
import {
  calculateRawScore,
  calculateWeightedScore,
  calculateReliability,
  calculateStandardError,
} from "@/lib/scoring/ctt/scoring";

// ---------------------------------------------------------------------------
// calculateRawScore
// ---------------------------------------------------------------------------
describe("calculateRawScore", () => {
  it("sums values and computes the percentage", () => {
    const r = calculateRawScore([
      { value: 4, maxValue: 5 },
      { value: 3, maxValue: 5 },
      { value: 5, maxValue: 5 },
    ]);
    expect(r.rawScore).toBe(12);
    expect(r.maxPossible).toBe(15);
    expect(r.percentage).toBeCloseTo(80, 10);
  });

  it("reverse-scores against the item max (0-based: effective = maxValue - value)", () => {
    // calculateRawScore assumes 0-based response values, so the lowest value
    // reverses to the maximum and vice-versa. (The session scorer in
    // ctt-session.ts adds the scale minimum for 1-based Likert items.)
    expect(calculateRawScore([{ value: 0, maxValue: 5, reverseScored: true }]).rawScore).toBe(5);
    expect(calculateRawScore([{ value: 5, maxValue: 5, reverseScored: true }]).rawScore).toBe(0);
    expect(calculateRawScore([{ value: 2, maxValue: 5, reverseScored: true }]).rawScore).toBe(3);
  });

  it("returns zeros for an empty response set", () => {
    expect(calculateRawScore([])).toEqual({ rawScore: 0, maxPossible: 0, percentage: 0 });
  });

  it("yields 0% at the floor and 100% at the ceiling", () => {
    expect(calculateRawScore([{ value: 0, maxValue: 5 }]).percentage).toBe(0);
    expect(calculateRawScore([{ value: 5, maxValue: 5 }]).percentage).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// calculateWeightedScore
// ---------------------------------------------------------------------------
describe("calculateWeightedScore", () => {
  it("weights each item's contribution to score and max", () => {
    // (2*4) + (1*2) = 10 ; max = (2*5) + (1*5) = 15
    const r = calculateWeightedScore([
      { value: 4, maxValue: 5, weight: 2 },
      { value: 2, maxValue: 5, weight: 1 },
    ]);
    expect(r.rawScore).toBe(10);
    expect(r.maxPossible).toBe(15);
    expect(r.percentage).toBeCloseTo((10 / 15) * 100, 10);
  });

  it("equal weights match the unweighted percentage", () => {
    const items = [
      { value: 4, maxValue: 5 },
      { value: 1, maxValue: 5 },
    ];
    const weighted = calculateWeightedScore(items.map((i) => ({ ...i, weight: 1 })));
    const raw = calculateRawScore(items);
    expect(weighted.percentage).toBeCloseTo(raw.percentage, 10);
  });

  it("applies reverse scoring before weighting", () => {
    // 0-based item: value 0 reverses to maxValue 5, then weighted by 3 = 15.
    const r = calculateWeightedScore([{ value: 0, maxValue: 5, weight: 3, reverseScored: true }]);
    expect(r.rawScore).toBe(15); // 3 * (5 - 0)
  });

  it("returns zeros for an empty response set", () => {
    expect(calculateWeightedScore([])).toEqual({ rawScore: 0, maxPossible: 0, percentage: 0 });
  });
});

// ---------------------------------------------------------------------------
// calculateReliability
// ---------------------------------------------------------------------------
describe("calculateReliability", () => {
  it("returns alpha = 1 and split-half = 1 for a perfectly consistent matrix", () => {
    // Each person answers all items identically; items perfectly correlated.
    const { cronbachAlpha, splitHalfReliability } = calculateReliability([
      [1, 1, 1],
      [2, 2, 2],
      [3, 3, 3],
    ]);
    expect(cronbachAlpha).toBeCloseTo(1, 10);
    expect(splitHalfReliability).toBeCloseTo(1, 10);
  });

  it("returns 0 when there is no between-person variance", () => {
    const { cronbachAlpha } = calculateReliability([
      [2, 2],
      [2, 2],
    ]);
    expect(cronbachAlpha).toBe(0);
  });

  it("alpha cannot exceed 1 for real data", () => {
    const { cronbachAlpha } = calculateReliability([
      [5, 4, 5, 4],
      [2, 1, 2, 1],
      [4, 4, 3, 4],
      [1, 2, 1, 1],
    ]);
    expect(cronbachAlpha).toBeLessThanOrEqual(1);
  });

  it("throws with fewer than 2 persons", () => {
    expect(() => calculateReliability([[1, 2, 3]])).toThrow(/2 persons/);
  });

  it("throws with fewer than 2 items", () => {
    expect(() => calculateReliability([[1], [2]])).toThrow(/2 items/);
  });

  it("throws on a ragged matrix (inconsistent item counts)", () => {
    expect(() => calculateReliability([[1, 2, 3], [1, 2]])).toThrow(/Inconsistent item count/);
  });
});

// ---------------------------------------------------------------------------
// calculateStandardError (SEM)
// ---------------------------------------------------------------------------
describe("calculateStandardError", () => {
  it("computes SD * sqrt(1 - reliability)", () => {
    expect(calculateStandardError(50, 0.75, 10)).toBeCloseTo(5, 10); // 10 * sqrt(0.25)
  });

  it("is 0 for a perfectly reliable test", () => {
    expect(calculateStandardError(50, 1, 10)).toBe(0);
  });

  it("equals the SD when reliability is 0", () => {
    expect(calculateStandardError(50, 0, 10)).toBeCloseTo(10, 10);
  });

  it("throws when reliability is outside [0, 1]", () => {
    expect(() => calculateStandardError(50, 1.2, 10)).toThrow(/between 0 and 1/);
    expect(() => calculateStandardError(50, -0.1, 10)).toThrow(/between 0 and 1/);
  });
});
