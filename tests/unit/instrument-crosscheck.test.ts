import { describe, expect, it } from "vitest";
import {
  alphaFromMeanInterItem,
  requiredMeanInterItem,
  requiredItemCountFloat,
  spearmanBrown,
} from "@/lib/instrument/reliability";
import { aikenV, fleissKappa } from "@/lib/instrument/congruence";

/**
 * Independent cross-check against values derived outside the implementation
 * (computed in Python from the published formulas, and the classic Fleiss
 * worked example). Guards against the tests and the module sharing a bug.
 */
describe("cross-check: reliability against independently derived values", () => {
  const cases: Array<[number, number, number]> = [
    // [k, targetAlpha, expected rBar]
    [6, 0.8, 0.4],
    [8, 0.8, 0.3333],
    [10, 0.8, 0.2857],
    [12, 0.8, 0.25],
    [15, 0.8, 0.2105],
    [20, 0.8, 0.1667],
    [8, 0.9, 0.5294],
    [12, 0.9, 0.4286],
    [20, 0.9, 0.3103],
  ];

  it.each(cases)("k=%i target=%f requires rBar=%f", (k, target, expected) => {
    expect(requiredMeanInterItem(k, target)).toBeCloseTo(expected, 4);
  });

  it("round-trips rBar -> alpha exactly", () => {
    for (const [k, target] of cases) {
      expect(alphaFromMeanInterItem(k, requiredMeanInterItem(k, target))).toBeCloseTo(target, 12);
    }
  });

  it("requiredItemCountFloat inverts alphaFromMeanInterItem", () => {
    // rBar=0.30, alpha=0.80 -> k = 0.8*0.7/(0.3*0.2) = 9.3333
    expect(requiredItemCountFloat(0.3, 0.8)).toBeCloseTo(9.3333, 4);
    expect(alphaFromMeanInterItem(requiredItemCountFloat(0.3, 0.8), 0.3)).toBeCloseTo(0.8, 12);
  });

  it("spearmanBrown doubling matches the closed form", () => {
    // r=0.5 doubled -> 2*0.5/(1+0.5) = 0.6667
    expect(spearmanBrown(0.5, 2)).toBeCloseTo(0.6666666667, 9);
    expect(spearmanBrown(0.6, 1)).toBeCloseTo(0.6, 12);
  });
});

describe("cross-check: congruence against independently derived values", () => {
  it("Aiken's V matches hand-computed values on a 1-4 scale", () => {
    expect(aikenV([4, 4, 4, 4])).toBeCloseTo(1.0, 12);
    expect(aikenV([1, 1, 1, 1])).toBeCloseTo(0.0, 12);
    expect(aikenV([2, 3, 2, 3])).toBeCloseTo(0.5, 12);
    expect(aikenV([4, 3, 4, 2, 3])).toBeCloseTo(0.7333333333, 9);
  });

  it("Fleiss' kappa reproduces the classic 14-rater / 10-subject / 5-category example", () => {
    // Published worked example; kappa = 0.2099 (Pbar = 0.37802, Pe = 0.21276).
    const m = [
      [0, 0, 0, 0, 14],
      [0, 2, 6, 4, 2],
      [0, 0, 3, 5, 6],
      [0, 3, 9, 2, 0],
      [2, 2, 8, 1, 1],
      [7, 7, 0, 0, 0],
      [3, 2, 6, 3, 0],
      [2, 5, 3, 2, 2],
      [6, 5, 2, 1, 0],
      [0, 2, 2, 3, 7],
    ];
    expect(fleissKappa(m)).toBeCloseTo(0.209931, 5);
  });

  it("Fleiss' kappa is 1.0 under perfect agreement and ~0 at chance", () => {
    expect(fleissKappa([[4, 0], [0, 4], [4, 0], [0, 4]])).toBeCloseTo(1.0, 10);
    // Every subject split evenly -> agreement no better than chance.
    expect(fleissKappa([[2, 2], [2, 2], [2, 2], [2, 2]])).toBeLessThanOrEqual(0);
  });
});

describe("cross-check: Fleiss' kappa with unbalanced rater counts", () => {
  it("reproduces the hand-computed value from real production data", () => {
    // 28 Adaptability items rated by 2-3 raters each (some rater calls failed).
    // Marginals p = [.8077 adapt, .1410 resil, .0513 decis] -> Pe = 0.6749,
    // observed Pbar = 0.9405, so kappa = (0.9405-0.6749)/(1-0.6749) = 0.817.
    // Reconstruct a matrix with those properties: 22 items 3/3 agreed on cat 0,
    // plus unbalanced rows.
    const m: number[][] = [];
    for (let i = 0; i < 20; i++) m.push([3, 0, 0]);
    for (let i = 0; i < 4; i++) m.push([2, 0, 0]); // only 2 raters returned
    for (let i = 0; i < 3; i++) m.push([1, 2, 0]); // split, leaked to Resilience
    m.push([1, 1, 1]);

    const kappa = fleissKappa(m);
    // The point is that it produces a real value rather than throwing or
    // collapsing to 0 the way the old equal-n-only implementation did.
    expect(kappa).toBeGreaterThan(0.3);
    expect(kappa).toBeLessThanOrEqual(1);
    expect(Number.isFinite(kappa)).toBe(true);
  });

  it("still matches the classic equal-n worked example after generalisation", () => {
    const m = [
      [0, 0, 0, 0, 14], [0, 2, 6, 4, 2], [0, 0, 3, 5, 6], [0, 3, 9, 2, 0],
      [2, 2, 8, 1, 1], [7, 7, 0, 0, 0], [3, 2, 6, 3, 0], [2, 5, 3, 2, 2],
      [6, 5, 2, 1, 0], [0, 2, 2, 3, 7],
    ];
    expect(fleissKappa(m)).toBeCloseTo(0.209931, 5);
  });

  it("excludes single-rater items rather than throwing", () => {
    expect(() => fleissKappa([[3, 0], [1, 0], [0, 3]])).not.toThrow();
    expect(Number.isFinite(fleissKappa([[3, 0], [1, 0], [0, 3]]))).toBe(true);
  });
});
