import { describe, it, expect } from "vitest";
import {
  detectLongString,
  detectEvenOddInconsistency,
  detectPsychometricAntonyms,
  detectResponseTimeFloor,
  pearsonR,
} from "@/lib/scoring/careless";

// =============================================================================
// LONG-STRING TESTS
// =============================================================================

describe("detectLongString", () => {
  it("returns null for empty array", () => {
    expect(detectLongString([])).toBeNull();
  });

  it("returns null for 1 item", () => {
    expect(detectLongString([1])).toBeNull();
  });

  it("returns null for 2 items", () => {
    expect(detectLongString([1, 1])).toBeNull();
  });

  it("treats an all-identical vector as the maximal long string, not as unmeasurable", () => {
    // A perfectly straight-lined session is the canonical careless case. Returning
    // null here meant it produced no flag at all, because the other indices also
    // bail on a zero-variance vector — so the clearest careless respondent in the
    // dataset would have passed.
    const result = detectLongString([5, 5, 5, 5, 5]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(5);
    expect(result!.value).toBe(5);
    expect(result!.itemIndices).toEqual([0, 1, 2, 3, 4]);
  });

  it("detects a long string of 5s at the start", () => {
    const result = detectLongString([5, 5, 5, 5, 1, 2, 3]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(4);
    expect(result!.value).toBe(5);
    expect(result!.itemIndices).toEqual([0, 1, 2, 3]);
  });

  it("detects a long string in the middle", () => {
    const result = detectLongString([1, 2, 3, 3, 3, 3, 5]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(4);
    expect(result!.value).toBe(3);
    expect(result!.itemIndices).toEqual([2, 3, 4, 5]);
  });

  it("detects a long string at the end", () => {
    const result = detectLongString([1, 2, 3, 4, 4, 4, 4, 4]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(5);
    expect(result!.value).toBe(4);
    expect(result!.itemIndices).toEqual([3, 4, 5, 6, 7]);
  });

  it("returns the longest run when multiple runs exist", () => {
    const result = detectLongString([1, 1, 1, 2, 2, 2, 2, 2, 3]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(5);
    expect(result!.value).toBe(2);
  });

  it("handles decimal values", () => {
    const result = detectLongString([1.5, 1.5, 2.0, 2.0, 2.0, 2.0, 2.0]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(5);
    expect(result!.value).toBe(2.0);
  });

  it("detects exactly length 3 run (threshold-adjacent)", () => {
    const result = detectLongString([5, 5, 5, 1, 2]);
    expect(result).not.toBeNull();
    expect(result!.maxRunLength).toBe(3);
  });
});

// =============================================================================
// EVEN-ODD CONSISTENCY TESTS
// =============================================================================

describe("detectEvenOddInconsistency", () => {
  it("returns null for < 4 items", () => {
    expect(detectEvenOddInconsistency([1, 2, 3])).toBeNull();
  });

  it("returns null for exactly 4 items where all are identical", () => {
    expect(detectEvenOddInconsistency([5, 5, 5, 5])).toBeNull();
  });

  it("returns null when variance is zero", () => {
    expect(detectEvenOddInconsistency([2, 2, 2, 2, 2])).toBeNull();
  });

  it("computes even-odd split for consistent respondent", () => {
    // Even: 1, 2; Odd: 1, 2
    const result = detectEvenOddInconsistency([1, 1, 2, 2]);
    expect(result).not.toBeNull();
    expect(result!.evenTotal).toBe(3); // 1 + 2
    expect(result!.oddTotal).toBe(3); // 1 + 2
  });

  it("returns high correlation for consistent half-scores", () => {
    // Even indices (0, 2, 4): [5, 4, 3]; Odd indices (1, 3, 5): [5, 4, 3]
    // Same pattern in both halves = high positive correlation
    const result = detectEvenOddInconsistency([5, 5, 4, 4, 3, 3]);
    expect(result).not.toBeNull();
    // Correlation should be perfectly positive (same pattern in both halves)
    expect(Number.isFinite(result!.correlation)).toBe(true);
    expect(result!.correlation).toBeGreaterThan(0.9); // Nearly perfect
  });

  it("returns low/negative correlation for inconsistent respondent", () => {
    // Even indices (0, 2, 4): [5, 1, 3] = varied
    // Odd indices (1, 3, 5): [1, 5, 1] = opposite pattern (high when even low, low when even high)
    const result = detectEvenOddInconsistency([5, 1, 1, 5, 3, 1]);
    expect(result).not.toBeNull();
    expect(result!.evenTotal).toBe(9); // 5 + 1 + 3
    expect(result!.oddTotal).toBe(7); // 1 + 5 + 1
    // Correlation should be strongly negative (opposite patterns)
    expect(result!.correlation).toBeLessThan(-0.3);
  });

  it("handles normalized scores with max values", () => {
    const responses = [20, 10, 10, 20, 15, 5]; // raw scores
    const maxValues = [20, 20, 20, 20, 20, 20]; // max per item
    const result = detectEvenOddInconsistency(responses, maxValues);
    expect(result).not.toBeNull();
    // Normalized even (0,2,4): [1.0, 0.5, 0.75]; odd (1,3,5): [0.5, 1.0, 0.25]
    // Should be computable (has variance in both halves)
    expect(Number.isFinite(result!.correlation)).toBe(true);
  });

  it("handles odd-length item lists", () => {
    // 5 items: even = indices 0,2,4; odd = indices 1,3
    const result = detectEvenOddInconsistency([1, 1, 1, 1, 1]);
    expect(result).toBeNull(); // All identical
  });

  it("detects perfectly inconsistent respondent (alternating high/low)", () => {
    const result = detectEvenOddInconsistency([5, 1, 5, 1, 5, 1, 4, 2]);
    expect(result).not.toBeNull();
    // Even (0,2,4,6): [5, 5, 5, 4]; Odd (1,3,5,7): [1, 1, 1, 2]
    // Opposite patterns = negative correlation
    expect(result!.correlation).toBeLessThan(-0.5);
    expect(result!.spearmanBrown).toBeLessThan(0.5); // Low reliability
  });

  it("returns NaN-safe result (Spearman-Brown >= 0)", () => {
    // Construct a case where r is very negative (opposite patterns)
    const result = detectEvenOddInconsistency([5, 1, 4, 2, 3, 1, 5, 2]);
    expect(result).not.toBeNull();
    // Should handle negative r without returning NaN
    expect(Number.isFinite(result!.spearmanBrown)).toBe(true);
    expect(result!.spearmanBrown).toBeGreaterThanOrEqual(0); // Never NaN or negative
  });
});

// =============================================================================
// PSYCHOMETRIC ANTONYMS TESTS
// =============================================================================

describe("detectPsychometricAntonyms", () => {
  it("returns null for < 2 items", () => {
    const result = detectPsychometricAntonyms([1], [
      { itemId: "i1", reverseScored: false, maxValue: 5 },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when no reverse-scored items", () => {
    const result = detectPsychometricAntonyms([1, 2, 3], [
      { itemId: "i1", reverseScored: false, maxValue: 5 },
      { itemId: "i2", reverseScored: false, maxValue: 5 },
      { itemId: "i3", reverseScored: false, maxValue: 5 },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when no forward-scored items", () => {
    const result = detectPsychometricAntonyms([1, 2, 3], [
      { itemId: "i1", reverseScored: true, maxValue: 5 },
      { itemId: "i2", reverseScored: true, maxValue: 5 },
      { itemId: "i3", reverseScored: true, maxValue: 5 },
    ]);
    expect(result).toBeNull();
  });

  // Scales here are 1-5, not 0-based. Reversal must be about the scale's own
  // midpoint (min + max - raw); using (max - raw) puts a top response below the
  // scale floor. And HIGH consistency after reversal means CAREFUL, not careless.
  it("scores a careful respondent as highly consistent", () => {
    // "I am organised" = 5, "I leave things messy" = 1.
    // Reversed: 1 + 5 - 1 = 5. Both read as 5 => consistent.
    const result = detectPsychometricAntonyms([5, 1], [
      { itemId: "i1", reverseScored: false, minValue: 1, maxValue: 5 },
      { itemId: "i2", reverseScored: true, minValue: 1, maxValue: 5 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.pairsFound).toBe(1);
    expect(result!.meanConsistencyRate).toBeCloseTo(1, 5);
  });

  it("scores a straight-lining respondent as inconsistent", () => {
    // Answers 5 to both. Reversed: 1 + 5 - 5 = 1. 5 vs 1 => contradiction.
    const result = detectPsychometricAntonyms([5, 5], [
      { itemId: "i1", reverseScored: false, minValue: 1, maxValue: 5 },
      { itemId: "i2", reverseScored: true, minValue: 1, maxValue: 5 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.meanConsistencyRate).toBeCloseTo(0, 5);
  });

  it("reverses about the scale floor, not zero, on a 1-6 scale", () => {
    // The live library has 300 items on a 6-point scale. With (max - raw) a
    // top response of 6 would reverse to 0 -- off the bottom of the scale.
    const result = detectPsychometricAntonyms([6, 1], [
      { itemId: "i1", reverseScored: false, minValue: 1, maxValue: 6 },
      { itemId: "i2", reverseScored: true, minValue: 1, maxValue: 6 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.meanConsistencyRate).toBeCloseTo(1, 5);
  });

  it("handles multiple forward-reverse pairs", () => {
    const result = detectPsychometricAntonyms([5, 1, 4, 2], [
      { itemId: "i1", reverseScored: false, minValue: 1, maxValue: 5 },
      { itemId: "i2", reverseScored: true, minValue: 1, maxValue: 5 },
      { itemId: "i3", reverseScored: false, minValue: 1, maxValue: 5 },
      { itemId: "i4", reverseScored: true, minValue: 1, maxValue: 5 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.pairsFound).toBe(4); // 2 forward x 2 reverse
  });

  it("normalises across items with different scale widths", () => {
    // A 1-10 forward item and a 1-5 reverse item, both answered consistently.
    const result = detectPsychometricAntonyms([10, 1], [
      { itemId: "i1", reverseScored: false, minValue: 1, maxValue: 10 },
      { itemId: "i2", reverseScored: true, minValue: 1, maxValue: 5 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.meanConsistencyRate).toBeCloseTo(1, 5);
  });

  it("skips a degenerate zero-width scale rather than dividing by zero", () => {
    const result = detectPsychometricAntonyms([3, 3], [
      { itemId: "i1", reverseScored: false, minValue: 3, maxValue: 3 },
      { itemId: "i2", reverseScored: true, minValue: 3, maxValue: 3 },
    ]);
    // No usable pair => not computable => null, never NaN and never 0.
    expect(result).toBeNull();
  });

  it("includes detailed per-pair results", () => {
    const result = detectPsychometricAntonyms([5, 1], [
      { itemId: "i1", reverseScored: false, maxValue: 5 },
      { itemId: "i2", reverseScored: true, maxValue: 5 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.pairs).toHaveLength(1);
    expect(result!.pairs[0].itemIdForward).toBe("i1");
    expect(result!.pairs[0].itemIdReverse).toBe("i2");
    expect(typeof result!.pairs[0].consistencyRate).toBe("number");
  });
});

// =============================================================================
// RESPONSE-TIME FLOOR TESTS
// =============================================================================

describe("detectResponseTimeFloor", () => {
  it("returns null for < 3 items", () => {
    expect(detectResponseTimeFloor([{ value: 1 }, { value: 2 }])).toBeNull();
  });

  it("returns null when no timing data available", () => {
    const result = detectResponseTimeFloor([
      { value: 1 },
      { value: 2 },
      { value: 3 },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when all times are null/undefined", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: undefined },
      { value: 2, responseTimeMs: undefined },
      { value: 3, responseTimeMs: undefined },
    ]);
    expect(result).toBeNull();
  });

  it("ignores zero and negative times", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: 500 },
      { value: 2, responseTimeMs: 0 },
      { value: 3, responseTimeMs: -100 },
      { value: 4, responseTimeMs: 600 },
    ]);
    // Only 2 valid times; need at least 3 items with valid times
    expect(result).toBeNull();
  });

  it("computes median from valid times", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: 100 },
      { value: 2, responseTimeMs: 200 },
      { value: 3, responseTimeMs: 300 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.medianMs).toBe(200);
  });

  it("detects floor effect (many responses < 1000ms)", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: 100 },
      { value: 2, responseTimeMs: 200 },
      { value: 3, responseTimeMs: 300 },
      { value: 4, responseTimeMs: 400 },
      { value: 5, responseTimeMs: 5000 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.floorDetected).toBe(true); // 4/5 < 1000ms
    expect(result!.fastResponseProportion).toBe(0.8);
  });

  it("does not detect floor effect (responses > 1000ms)", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: 2000 },
      { value: 2, responseTimeMs: 3000 },
      { value: 3, responseTimeMs: 4000 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.floorDetected).toBe(false);
    expect(result!.fastResponseProportion).toBe(0);
  });

  it("reports min and max times", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: 50 },
      { value: 2, responseTimeMs: 500 },
      { value: 3, responseTimeMs: 2000 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.minMs).toBe(50);
    expect(result!.maxMs).toBe(2000);
  });

  it("handles mixed null and valid times", () => {
    const result = detectResponseTimeFloor([
      { value: 1, responseTimeMs: 100 },
      { value: 2 }, // no timing
      { value: 3, responseTimeMs: 200 },
      { value: 4 }, // no timing
      { value: 5, responseTimeMs: 300 },
    ]);
    expect(result).not.toBeNull();
    expect(result!.medianMs).toBe(200);
  });
});

// =============================================================================
// PEARSON R TESTS
// =============================================================================

describe("pearsonR", () => {
  it("returns NaN for empty vectors", () => {
    expect(pearsonR([], [])).toBeNaN();
  });

  it("returns NaN for mismatched lengths", () => {
    expect(pearsonR([1, 2], [1, 2, 3])).toBeNaN();
  });

  it("returns NaN when x has zero variance", () => {
    expect(pearsonR([5, 5, 5], [1, 2, 3])).toBeNaN();
  });

  it("returns NaN when y has zero variance", () => {
    expect(pearsonR([1, 2, 3], [5, 5, 5])).toBeNaN();
  });

  it("returns 1 for perfect positive correlation", () => {
    expect(pearsonR([1, 2, 3], [1, 2, 3])).toBe(1);
  });

  it("returns -1 for perfect negative correlation", () => {
    expect(pearsonR([1, 2, 3], [3, 2, 1])).toBe(-1);
  });

  it("computes correlation for imperfect relationship", () => {
    const r = pearsonR([1, 2, 3, 4], [2, 3, 4, 5]); // Shifted by 1
    expect(r).toBe(1); // Still perfect (just shifted)
  });

  it("handles negative values", () => {
    const r = pearsonR([-1, -2, -3], [1, 2, 3]);
    expect(r).toBe(-1);
  });

  it("handles decimals", () => {
    const r = pearsonR([1.5, 2.5, 3.5], [1.5, 2.5, 3.5]);
    expect(r).toBe(1);
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe("Careless detection — realistic scenario", () => {
  it("identifies careless respondent using all indices", () => {
    // A careless respondent: long strings of 5s throughout
    const responses = [5, 5, 5, 5, 5, 5, 5, 1, 1, 2];
    const longString = detectLongString(responses);
    const evenOdd = detectEvenOddInconsistency(responses);

    // Should detect long string (7 consecutive 5s)
    expect(longString).not.toBeNull();
    expect(longString!.maxRunLength).toBeGreaterThanOrEqual(7);

    // Should have responses (may or may not detect inconsistency depending on pattern)
    if (evenOdd) {
      expect(evenOdd.evenTotal).toBeGreaterThan(0);
    }
  });

  it("identifies attentive respondent", () => {
    // Attentive respondent: varied responses with consistent pattern
    // Even indices (0,2,4,6): [5, 4, 3, 2]
    // Odd indices (1,3,5,7): [5, 4, 3, 2]
    // Same pattern in both halves = high correlation
    const responses = [5, 5, 4, 4, 3, 3, 2, 2];
    const longString = detectLongString(responses);
    const evenOdd = detectEvenOddInconsistency(responses);

    // Should not detect long string (max run is 2)
    expect(longString).not.toBeNull();
    expect(longString!.maxRunLength).toBeLessThanOrEqual(2);

    // Should detect high consistency
    expect(evenOdd).not.toBeNull();
    expect(evenOdd!.spearmanBrown).toBeGreaterThan(0.7);
  });
});
