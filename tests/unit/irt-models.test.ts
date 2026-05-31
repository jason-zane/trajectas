import { describe, expect, it } from "vitest";
import {
  probability1PL,
  probability2PL,
  probability3PL,
  probability,
  itemInformation,
  testInformation,
  standardError,
} from "@/lib/scoring/irt/models";
import type { IRTParameters } from "@/types/scoring";

const params = (
  overrides: Partial<IRTParameters> & Pick<IRTParameters, "modelType">,
): IRTParameters => ({
  discrimination: 1,
  difficulty: 0,
  guessing: 0,
  ...overrides,
});

// ---------------------------------------------------------------------------
// probability1PL (Rasch)
// ---------------------------------------------------------------------------
describe("probability1PL", () => {
  it("returns 0.5 when theta equals difficulty", () => {
    expect(probability1PL(0, 0)).toBeCloseTo(0.5, 10);
    expect(probability1PL(2, 2)).toBeCloseTo(0.5, 10);
  });

  it("is above 0.5 when ability exceeds difficulty", () => {
    expect(probability1PL(1, 0)).toBeGreaterThan(0.5);
  });

  it("is below 0.5 when ability is below difficulty", () => {
    expect(probability1PL(-1, 0)).toBeLessThan(0.5);
  });

  it("is monotonically increasing in theta", () => {
    expect(probability1PL(-2, 0)).toBeLessThan(probability1PL(0, 0));
    expect(probability1PL(0, 0)).toBeLessThan(probability1PL(2, 0));
  });

  it("matches the closed-form logistic value", () => {
    // P(1, 0) = 1 / (1 + e^-1) = 0.7310585786
    expect(probability1PL(1, 0)).toBeCloseTo(0.7310585786, 9);
  });

  it("asymptotes to 0 and 1 at the extremes", () => {
    expect(probability1PL(-20, 0)).toBeCloseTo(0, 6);
    expect(probability1PL(20, 0)).toBeCloseTo(1, 6);
  });
});

// ---------------------------------------------------------------------------
// probability2PL
// ---------------------------------------------------------------------------
describe("probability2PL", () => {
  it("returns 0.5 at the difficulty regardless of discrimination", () => {
    expect(probability2PL(0, 2.5, 0)).toBeCloseTo(0.5, 10);
    expect(probability2PL(1, 0.3, 1)).toBeCloseTo(0.5, 10);
  });

  it("reduces to the 1PL model when a = 1", () => {
    for (const theta of [-2, -0.5, 0, 0.5, 2]) {
      expect(probability2PL(theta, 1, 0.4)).toBeCloseTo(
        probability1PL(theta, 0.4),
        12,
      );
    }
  });

  it("a higher discrimination yields a steeper curve away from b", () => {
    // Above difficulty: higher a -> closer to 1.
    expect(probability2PL(1, 2, 0)).toBeGreaterThan(probability2PL(1, 0.5, 0));
    // Below difficulty: higher a -> closer to 0.
    expect(probability2PL(-1, 2, 0)).toBeLessThan(probability2PL(-1, 0.5, 0));
  });
});

// ---------------------------------------------------------------------------
// probability3PL
// ---------------------------------------------------------------------------
describe("probability3PL", () => {
  it("never drops below the guessing floor", () => {
    expect(probability3PL(-50, 1, 0, 0.25)).toBeCloseTo(0.25, 6);
  });

  it("returns (1 + c) / 2 at the difficulty", () => {
    expect(probability3PL(0, 1.5, 0, 0.2)).toBeCloseTo(0.6, 10);
  });

  it("asymptotes to 1 at high ability", () => {
    expect(probability3PL(50, 1, 0, 0.25)).toBeCloseTo(1, 6);
  });

  it("reduces to 2PL when c = 0", () => {
    expect(probability3PL(0.7, 1.3, 0.2, 0)).toBeCloseTo(
      probability2PL(0.7, 1.3, 0.2),
      12,
    );
  });
});

// ---------------------------------------------------------------------------
// probability (dispatcher)
// ---------------------------------------------------------------------------
describe("probability dispatcher", () => {
  it("routes 1PL using only difficulty (ignores a and c)", () => {
    const p = probability(1, params({ modelType: "1PL", discrimination: 99, guessing: 0.9, difficulty: 0 }));
    expect(p).toBeCloseTo(probability1PL(1, 0), 12);
  });

  it("routes 2PL using a and b (ignores c)", () => {
    const p = probability(1, params({ modelType: "2PL", discrimination: 1.5, guessing: 0.9, difficulty: 0 }));
    expect(p).toBeCloseTo(probability2PL(1, 1.5, 0), 12);
  });

  it("routes 3PL using a, b and c", () => {
    const p = probability(0, params({ modelType: "3PL", discrimination: 1.5, guessing: 0.2, difficulty: 0 }));
    expect(p).toBeCloseTo(0.6, 10);
  });
});

// ---------------------------------------------------------------------------
// itemInformation
// ---------------------------------------------------------------------------
describe("itemInformation", () => {
  it("for 2PL peaks at the difficulty and equals a^2 / 4 there", () => {
    const item = params({ modelType: "2PL", discrimination: 2, difficulty: 0 });
    const atB = itemInformation(0, item);
    expect(atB).toBeCloseTo(1, 10); // 2^2 * 0.25 = 1
    // Information is lower away from b.
    expect(itemInformation(2, item)).toBeLessThan(atB);
    expect(itemInformation(-2, item)).toBeLessThan(atB);
  });

  it("for 1PL at b equals 0.25", () => {
    expect(itemInformation(0, params({ modelType: "1PL", difficulty: 0 }))).toBeCloseTo(0.25, 10);
  });

  it("is always non-negative", () => {
    for (const theta of [-4, -1, 0, 1, 4]) {
      expect(itemInformation(theta, params({ modelType: "3PL", discrimination: 1.2, guessing: 0.2 }))).toBeGreaterThanOrEqual(0);
    }
  });

  it("guessing reduces information relative to the c=0 case", () => {
    const withGuess = itemInformation(0, params({ modelType: "3PL", discrimination: 1, difficulty: 0, guessing: 0.25 }));
    const noGuess = itemInformation(0, params({ modelType: "2PL", discrimination: 1, difficulty: 0 }));
    expect(withGuess).toBeLessThan(noGuess);
  });
});

// ---------------------------------------------------------------------------
// testInformation & standardError
// ---------------------------------------------------------------------------
describe("testInformation", () => {
  it("sums item information across the pool", () => {
    const items = [
      params({ modelType: "2PL", discrimination: 2, difficulty: 0 }),
      params({ modelType: "2PL", discrimination: 2, difficulty: 0 }),
    ];
    expect(testInformation(0, items)).toBeCloseTo(2, 10); // 1 + 1
  });

  it("is zero for an empty pool", () => {
    expect(testInformation(0, [])).toBe(0);
  });
});

describe("standardError", () => {
  it("is the reciprocal square root of test information", () => {
    const items = [
      params({ modelType: "2PL", discrimination: 2, difficulty: 0 }),
      params({ modelType: "2PL", discrimination: 2, difficulty: 0 }),
    ];
    // info = 2 -> SE = 1/sqrt(2)
    expect(standardError(0, items)).toBeCloseTo(1 / Math.SQRT2, 10);
  });

  it("returns Infinity when there is no information", () => {
    expect(standardError(0, [])).toBe(Infinity);
  });

  it("shrinks as more items are added", () => {
    const one = [params({ modelType: "2PL", discrimination: 1, difficulty: 0 })];
    const many = Array.from({ length: 10 }, () => params({ modelType: "2PL", discrimination: 1, difficulty: 0 }));
    expect(standardError(0, many)).toBeLessThan(standardError(0, one));
  });
});
