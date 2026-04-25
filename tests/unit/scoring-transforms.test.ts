import { describe, expect, it } from "vitest";
import {
  toPomp,
  toZScore,
  toTScore,
  scoreToTScore,
  toStanine,
  scoreToStanine,
  toSten,
  scoreToSten,
  toPercentile,
  scoreToPercentile,
  buildScoreRepresentations,
  normalCDF,
  normalQuantile,
} from "@/lib/scoring/transforms";
import type { NormParameters } from "@/types/scoring";

// ---------------------------------------------------------------------------
// toPomp
// ---------------------------------------------------------------------------
describe("toPomp", () => {
  it("returns 0 when observed equals min", () => {
    expect(toPomp(1, 1, 5)).toBe(0);
  });

  it("returns 100 when observed equals max", () => {
    expect(toPomp(5, 1, 5)).toBe(100);
  });

  it("returns 50 for midpoint", () => {
    expect(toPomp(3, 1, 5)).toBe(50);
  });

  it("returns 0 when max equals min (degenerate scale)", () => {
    expect(toPomp(5, 5, 5)).toBe(0);
  });

  it("clamps below 0 when observed is below min", () => {
    expect(toPomp(-1, 0, 10)).toBe(0);
  });

  it("clamps above 100 when observed exceeds max", () => {
    expect(toPomp(12, 0, 10)).toBe(100);
  });

  it("handles zero-based scales", () => {
    expect(toPomp(5, 0, 10)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// toZScore
// ---------------------------------------------------------------------------
describe("toZScore", () => {
  it("returns 0 when score equals mean", () => {
    expect(toZScore(50, 50, 10)).toBe(0);
  });

  it("returns positive Z for score above mean", () => {
    expect(toZScore(60, 50, 10)).toBe(1);
  });

  it("returns negative Z for score below mean", () => {
    expect(toZScore(40, 50, 10)).toBe(-1);
  });

  it("returns 0 when sd is zero", () => {
    expect(toZScore(60, 50, 0)).toBe(0);
  });

  it("returns 0 when sd is negative", () => {
    expect(toZScore(60, 50, -5)).toBe(0);
  });

  it("handles large deviations", () => {
    expect(toZScore(80, 50, 10)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// toTScore
// ---------------------------------------------------------------------------
describe("toTScore", () => {
  it("returns 50 for Z of 0", () => {
    expect(toTScore(0)).toBe(50);
  });

  it("returns 60 for Z of 1", () => {
    expect(toTScore(1)).toBe(60);
  });

  it("returns 40 for Z of -1", () => {
    expect(toTScore(-1)).toBe(40);
  });

  it("returns 30 for Z of -2", () => {
    expect(toTScore(-2)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// scoreToTScore
// ---------------------------------------------------------------------------
describe("scoreToTScore", () => {
  it("combines Z and T conversion", () => {
    // score=60, mean=50, sd=10 → Z=1 → T=60
    expect(scoreToTScore(60, 50, 10)).toBe(60);
  });

  it("returns 50 when score equals mean", () => {
    expect(scoreToTScore(50, 50, 10)).toBe(50);
  });

  it("returns 50 when sd is 0 (Z defaults to 0)", () => {
    expect(scoreToTScore(60, 50, 0)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// toStanine
// ---------------------------------------------------------------------------
describe("toStanine", () => {
  it("returns 1 for very low Z", () => {
    expect(toStanine(-2.0)).toBe(1);
  });

  it("returns 5 for Z of 0", () => {
    expect(toStanine(0)).toBe(5);
  });

  it("returns 9 for very high Z", () => {
    expect(toStanine(2.0)).toBe(9);
  });

  it("returns correct stanines at boundary cutpoints", () => {
    // Just below -1.75 → stanine 1
    expect(toStanine(-1.76)).toBe(1);
    // Just above -1.75 → stanine 2 (since -1.74 is NOT < -1.75)
    expect(toStanine(-1.74)).toBe(2);
    // Just below +1.75 → stanine 8
    expect(toStanine(1.74)).toBe(8);
    // At exactly +1.75 → not less than 1.75, so continues to 9
    expect(toStanine(1.75)).toBe(9);
  });

  it("walks all 9 bins with standard cutpoints", () => {
    const zValues = [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0];
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    zValues.forEach((z, i) => {
      expect(toStanine(z)).toBe(expected[i]);
    });
  });

  it("accepts custom cutpoints", () => {
    const custom = [-1.0, -0.5, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5];
    expect(toStanine(-1.5, custom)).toBe(1);
    expect(toStanine(0.1, custom)).toBe(4);
    expect(toStanine(2.0, custom)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// scoreToStanine
// ---------------------------------------------------------------------------
describe("scoreToStanine", () => {
  it("converts raw score through Z to stanine", () => {
    // score=50, mean=50, sd=10 → Z=0 → stanine 5
    expect(scoreToStanine(50, 50, 10)).toBe(5);
  });

  it("returns 5 when sd is 0 (Z defaults to 0)", () => {
    expect(scoreToStanine(80, 50, 0)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// toSten
// ---------------------------------------------------------------------------
describe("toSten", () => {
  it("returns 1 for very low Z", () => {
    expect(toSten(-2.5)).toBe(1);
  });

  it("returns 6 for Z just above 0", () => {
    // Z=0.1 is not < 0.0, so goes past cutpoint 5 (0.0); but 0.1 < 0.5 → sten 6
    expect(toSten(0.1)).toBe(6);
  });

  it("returns 10 for very high Z", () => {
    expect(toSten(2.5)).toBe(10);
  });

  it("returns correct values at boundaries", () => {
    // Exactly at -2.0 → not less than -2.0, so passes to next: sten 2
    expect(toSten(-2.0)).toBe(2);
    // Just below -2.0 → sten 1
    expect(toSten(-2.01)).toBe(1);
    // Exactly at 2.0 → not less than 2.0, passes last cutpoint → sten 10
    expect(toSten(2.0)).toBe(10);
  });

  it("walks all 10 bins with standard cutpoints", () => {
    const zValues = [-2.5, -1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75, 2.5];
    const expected = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    zValues.forEach((z, i) => {
      expect(toSten(z)).toBe(expected[i]);
    });
  });

  it("accepts custom cutpoints", () => {
    const custom = [-1.5, -1.0, -0.5, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5];
    expect(toSten(-2.0, custom)).toBe(1);
    expect(toSten(0.1, custom)).toBe(5);
    expect(toSten(2.0, custom)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// scoreToSten
// ---------------------------------------------------------------------------
describe("scoreToSten", () => {
  it("converts raw score through Z to sten", () => {
    // score=50, mean=50, sd=10 → Z=0 → at cutpoint 0.0, not less → sten 6
    expect(scoreToSten(50, 50, 10)).toBe(6);
  });

  it("returns 6 when sd is 0 (Z defaults to 0)", () => {
    expect(scoreToSten(80, 50, 0)).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// normalCDF
// ---------------------------------------------------------------------------
describe("normalCDF", () => {
  it("returns ~0.5 for Z=0", () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it("returns ~0.8413 for Z=1", () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it("returns ~0.1587 for Z=-1", () => {
    expect(normalCDF(-1)).toBeCloseTo(0.1587, 3);
  });

  it("returns ~0.9772 for Z=2", () => {
    expect(normalCDF(2)).toBeCloseTo(0.9772, 3);
  });

  it("returns 0 for extremely low Z", () => {
    expect(normalCDF(-9)).toBe(0);
  });

  it("returns 1 for extremely high Z", () => {
    expect(normalCDF(9)).toBe(1);
  });

  it("is symmetric: CDF(z) + CDF(-z) ≈ 1", () => {
    for (const z of [0.5, 1.0, 1.5, 2.0, 2.5]) {
      expect(normalCDF(z) + normalCDF(-z)).toBeCloseTo(1, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// normalQuantile
// ---------------------------------------------------------------------------
describe("normalQuantile", () => {
  it("returns 0 for p=0.5", () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 2);
  });

  it("returns ~1.645 for p=0.95", () => {
    expect(normalQuantile(0.95)).toBeCloseTo(1.645, 1);
  });

  it("returns ~-1.645 for p=0.05", () => {
    expect(normalQuantile(0.05)).toBeCloseTo(-1.645, 1);
  });

  it("returns ~1.96 for p=0.975", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 1);
  });

  it("returns -Infinity for p=0", () => {
    expect(normalQuantile(0)).toBe(-Infinity);
  });

  it("returns Infinity for p=1", () => {
    expect(normalQuantile(1)).toBe(Infinity);
  });

  it("is antisymmetric: Q(p) ≈ -Q(1-p)", () => {
    for (const p of [0.1, 0.25, 0.4]) {
      expect(normalQuantile(p)).toBeCloseTo(-normalQuantile(1 - p), 4);
    }
  });
});

// ---------------------------------------------------------------------------
// toPercentile
// ---------------------------------------------------------------------------
describe("toPercentile", () => {
  it("returns 50 for Z=0", () => {
    expect(toPercentile(0)).toBe(50);
  });

  it("returns 84 for Z=1", () => {
    expect(toPercentile(1)).toBe(84);
  });

  it("returns 16 for Z=-1", () => {
    expect(toPercentile(-1)).toBe(16);
  });

  it("clamps at 1 for extremely low Z", () => {
    expect(toPercentile(-10)).toBe(1);
  });

  it("clamps at 99 for extremely high Z", () => {
    expect(toPercentile(10)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// scoreToPercentile
// ---------------------------------------------------------------------------
describe("scoreToPercentile", () => {
  it("returns 50 when score equals mean", () => {
    expect(scoreToPercentile(50, 50, 10)).toBe(50);
  });

  it("returns high percentile for score well above mean", () => {
    expect(scoreToPercentile(70, 50, 10)).toBeGreaterThan(90);
  });

  it("returns 50 when sd is 0 (Z defaults to 0)", () => {
    expect(scoreToPercentile(80, 50, 0)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// buildScoreRepresentations
// ---------------------------------------------------------------------------
describe("buildScoreRepresentations", () => {
  it("computes raw and POMP without norms", () => {
    const result = buildScoreRepresentations(8, 10, 0);
    expect(result.raw).toBe(8);
    expect(result.rawMax).toBe(10);
    expect(result.pomp).toBe(80);
    expect(result.zScore).toBeUndefined();
    expect(result.tScore).toBeUndefined();
    expect(result.stanine).toBeUndefined();
    expect(result.sten).toBeUndefined();
    expect(result.percentile).toBeUndefined();
    expect(result.normGroupId).toBeUndefined();
  });

  it("computes all norm-referenced scores when norms are provided", () => {
    const norms: NormParameters = {
      mean: 50,
      sd: 10,
      normGroupId: "norm-1",
    };
    const result = buildScoreRepresentations(8, 10, 0, norms);

    expect(result.raw).toBe(8);
    expect(result.pomp).toBe(80);
    expect(result.zScore).toBe(3); // (80 - 50) / 10
    expect(result.tScore).toBe(80); // 50 + 10 * 3
    expect(result.stanine).toBe(9);
    expect(result.sten).toBe(10);
    expect(result.percentile).toBe(99);
    expect(result.normGroupId).toBe("norm-1");
  });

  it("skips norm-referenced scores when sd is 0", () => {
    const norms: NormParameters = { mean: 50, sd: 0, normGroupId: "norm-x" };
    const result = buildScoreRepresentations(8, 10, 0, norms);

    expect(result.zScore).toBeUndefined();
    expect(result.tScore).toBeUndefined();
  });

  it("passes custom cutpoints to stanine and sten", () => {
    const norms: NormParameters = {
      mean: 50,
      sd: 25,
      normGroupId: "norm-custom",
      stanineCutpoints: [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75],
      stenCutpoints: [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0],
    };
    const result = buildScoreRepresentations(50, 100, 0, norms);
    // POMP = 50, Z = (50-50)/25 = 0
    expect(result.stanine).toBe(5); // Z=0 → stanine 5
    expect(result.sten).toBe(6); // Z=0, at cutpoint 0.0 → sten 6
  });

  it("computes confidence interval when se is provided", () => {
    const result = buildScoreRepresentations(8, 10, 0, undefined, 5, 0.95);

    expect(result.standardError).toBe(5);
    expect(result.confidence).toBeDefined();
    expect(result.confidence!.level).toBe(0.95);
    // Z for 97.5% ≈ 1.96, so interval ≈ 80 ± 9.8
    expect(result.confidence!.lower).toBeCloseTo(80 - 1.96 * 5, 0);
    expect(result.confidence!.upper).toBeCloseTo(80 + 1.96 * 5, 0);
  });

  it("does not add confidence when se is 0", () => {
    const result = buildScoreRepresentations(8, 10, 0, undefined, 0);
    expect(result.standardError).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });

  it("does not add confidence when se is undefined", () => {
    const result = buildScoreRepresentations(8, 10, 0);
    expect(result.standardError).toBeUndefined();
    expect(result.confidence).toBeUndefined();
  });

  it("uses default rawMin of 0", () => {
    const result = buildScoreRepresentations(5, 10);
    expect(result.pomp).toBe(50);
  });

  it("uses default ciLevel of 0.95", () => {
    const result = buildScoreRepresentations(5, 10, 0, undefined, 2);
    expect(result.confidence!.level).toBe(0.95);
  });

  it("handles non-zero rawMin", () => {
    // rawMin=1, rawMax=5, raw=3 → POMP = ((3-1)/(5-1))*100 = 50
    const result = buildScoreRepresentations(3, 5, 1);
    expect(result.pomp).toBe(50);
  });

  it("handles custom ciLevel", () => {
    const result = buildScoreRepresentations(5, 10, 0, undefined, 2, 0.90);
    expect(result.confidence!.level).toBe(0.90);
  });
});
