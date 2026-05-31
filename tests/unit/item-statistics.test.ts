import { describe, expect, it } from "vitest";
import {
  buildResponseMatrix,
  itemDifficulty,
  correctedItemTotalCorrelation,
  alphaIfDeleted,
  responseDistribution,
  distractorAnalysis,
  computeItemStatistics,
} from "@/lib/scoring/item-statistics";

// ---------------------------------------------------------------------------
// itemDifficulty
// ---------------------------------------------------------------------------
describe("itemDifficulty", () => {
  it("is the mean score divided by the max value", () => {
    expect(itemDifficulty([1, 2, 3, 4, 5], 5)).toBeCloseTo(0.6, 10);
  });

  it("returns 0 for empty scores or a zero max", () => {
    expect(itemDifficulty([], 5)).toBe(0);
    expect(itemDifficulty([3, 4], 0)).toBe(0);
  });

  it("is 1 when everyone scores the maximum", () => {
    expect(itemDifficulty([5, 5, 5], 5)).toBeCloseTo(1, 10);
  });
});

// ---------------------------------------------------------------------------
// correctedItemTotalCorrelation
// ---------------------------------------------------------------------------
describe("correctedItemTotalCorrelation", () => {
  it("is ~1 when the item tracks the corrected total perfectly", () => {
    const itemScores = [1, 2, 3, 4];
    const totals = [2, 4, 6, 8]; // corrected total = total - item = item
    expect(correctedItemTotalCorrelation(itemScores, totals)).toBeCloseTo(1, 10);
  });

  it("is negative when the item runs against the total", () => {
    const itemScores = [4, 3, 2, 1];
    const totals = [5, 6, 7, 8]; // corrected = [1,3,5,7] increases as item decreases
    expect(correctedItemTotalCorrelation(itemScores, totals)).toBeLessThan(0);
  });

  it("returns 0 with fewer than 3 observations", () => {
    expect(correctedItemTotalCorrelation([1, 2], [3, 4])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// alphaIfDeleted
// ---------------------------------------------------------------------------
describe("alphaIfDeleted", () => {
  it("computes alpha over the remaining items", () => {
    const m = new Map<string, number[]>([
      ["i1", [1, 2, 3]],
      ["i2", [1, 2, 3]],
      ["i3", [1, 2, 3]],
    ]);
    // Removing i3 leaves two perfectly-correlated items -> alpha = 1.
    expect(alphaIfDeleted(m, "i3")).toBeCloseTo(1, 10);
  });

  it("returns 0 when fewer than 2 items remain", () => {
    const m = new Map<string, number[]>([
      ["i1", [1, 2, 3]],
      ["i2", [1, 2, 3]],
    ]);
    expect(alphaIfDeleted(m, "i2")).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// responseDistribution
// ---------------------------------------------------------------------------
describe("responseDistribution", () => {
  it("counts the frequency of each value", () => {
    expect(responseDistribution([1, 1, 2, 3, 3, 3])).toEqual({ 1: 2, 2: 1, 3: 3 });
  });

  it("is an empty object for no responses", () => {
    expect(responseDistribution([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// buildResponseMatrix
// ---------------------------------------------------------------------------
describe("buildResponseMatrix", () => {
  it("groups by participant and applies reverse scoring to totals", () => {
    const matrix = buildResponseMatrix([
      { participantId: "p1", itemId: "A", value: 4, maxValue: 5 },
      { participantId: "p1", itemId: "B", value: 2, maxValue: 5, reverseScored: true }, // effective 3
      { participantId: "p2", itemId: "A", value: 1, maxValue: 5 },
      { participantId: "p2", itemId: "B", value: 5, maxValue: 5, reverseScored: true }, // effective 0
    ]);

    expect(matrix.n).toBe(2);
    expect(matrix.itemResponses.get("A")).toEqual([4, 1]);
    expect(matrix.itemResponses.get("B")).toEqual([3, 0]); // reverse-scored
    expect(matrix.totalScores).toEqual([7, 1]); // 4+3, 1+0
    expect(matrix.itemMaxValues.get("A")).toBe(5);
  });

  it("treats a missing response as 0", () => {
    const matrix = buildResponseMatrix([
      { participantId: "p1", itemId: "A", value: 3, maxValue: 5 },
      { participantId: "p1", itemId: "B", value: 4, maxValue: 5 },
      { participantId: "p2", itemId: "A", value: 2, maxValue: 5 },
      // p2 has no response for B
    ]);
    expect(matrix.itemResponses.get("B")).toEqual([4, 0]);
    expect(matrix.totalScores).toEqual([7, 2]);
  });
});

// ---------------------------------------------------------------------------
// distractorAnalysis
// ---------------------------------------------------------------------------
describe("distractorAnalysis", () => {
  it("returns one entry per distinct option with correct counts and proportions", () => {
    const raw = [1, 2, 3, 2, 1];
    const totals = [5, 8, 10, 8, 5];
    const result = distractorAnalysis(raw, totals, new Map());

    expect(result.map((r) => r.optionValue)).toEqual([1, 2, 3]); // sorted
    const byValue = Object.fromEntries(result.map((r) => [r.optionValue, r]));
    expect(byValue[1].count).toBe(2);
    expect(byValue[2].count).toBe(2);
    expect(byValue[3].count).toBe(1);
    expect(byValue[1].proportion).toBeCloseTo(0.4, 10);
    for (const r of result) {
      expect(r.pointBiserial).toBeGreaterThanOrEqual(-1);
      expect(r.pointBiserial).toBeLessThanOrEqual(1);
    }
  });

  it("uses the provided option labels", () => {
    const result = distractorAnalysis([1, 2, 1, 2, 1], [3, 4, 3, 4, 3], new Map([[1, "A"], [2, "B"]]));
    expect(result.find((r) => r.optionValue === 1)?.optionLabel).toBe("A");
  });

  it("returns an empty array with fewer than 3 observations", () => {
    expect(distractorAnalysis([1, 2], [3, 4], new Map())).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// computeItemStatistics
// ---------------------------------------------------------------------------
describe("computeItemStatistics", () => {
  it("flags an item that is too easy and non-discriminating", () => {
    const matrix = buildResponseMatrix([
      // "easy" item: everyone scores the max -> difficulty 1.0, zero variance.
      ...[1, 2, 3, 4, 5].map((p) => ({ participantId: `p${p}`, itemId: "easy", value: 5, maxValue: 5 })),
      // "spread" item: varied responses.
      { participantId: "p1", itemId: "spread", value: 1, maxValue: 5 },
      { participantId: "p2", itemId: "spread", value: 2, maxValue: 5 },
      { participantId: "p3", itemId: "spread", value: 3, maxValue: 5 },
      { participantId: "p4", itemId: "spread", value: 4, maxValue: 5 },
      { participantId: "p5", itemId: "spread", value: 5, maxValue: 5 },
    ]);

    const stats = computeItemStatistics(matrix);
    expect(stats).toHaveLength(2);

    const easy = stats.find((s) => s.itemId === "easy")!;
    expect(easy.difficulty).toBeCloseTo(1, 10);
    expect(easy.flagged).toBe(true);
    expect(easy.flagReasons.some((r) => /too easy/i.test(r))).toBe(true);
    expect(easy.responseCount).toBe(5);
  });

  it("reports difficulty and discrimination for every item", () => {
    const matrix = buildResponseMatrix([
      { participantId: "p1", itemId: "x", value: 1, maxValue: 5 },
      { participantId: "p2", itemId: "x", value: 3, maxValue: 5 },
      { participantId: "p3", itemId: "x", value: 5, maxValue: 5 },
      { participantId: "p1", itemId: "y", value: 2, maxValue: 5 },
      { participantId: "p2", itemId: "y", value: 3, maxValue: 5 },
      { participantId: "p3", itemId: "y", value: 4, maxValue: 5 },
    ]);
    const stats = computeItemStatistics(matrix);
    for (const s of stats) {
      expect(typeof s.difficulty).toBe("number");
      expect(typeof s.discrimination).toBe("number");
      expect(s.difficulty).toBeGreaterThanOrEqual(0);
      expect(s.difficulty).toBeLessThanOrEqual(1);
    }
  });
});
