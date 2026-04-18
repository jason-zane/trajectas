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

  it("returns 50 at the midpoint", () => {
    expect(toPomp(3, 1, 5)).toBe(50);
  });

  it("returns 0 when max equals min", () => {
    expect(toPomp(5, 5, 5)).toBe(0);
  });

  it("clamps below 0 when observed is below min", () => {
    expect(toPomp(-1, 0, 10)).toBe(0);
  });

  it("clamps above 100 when observed exceeds max", () => {
    expect(toPomp(15, 0, 10)).toBe(100);
  });

  it("handles 0-based scales", () => {
    expect(toPomp(0, 0, 100)).toBe(0);
    expect(toPomp(100, 0, 100)).toBe(100);
    expect(toPomp(25, 0, 100)).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// toZScore
// ---------------------------------------------------------------------------

describe("toZScore", () => {
  it("returns 0 when score equals mean", () => {
    expect(toZScore(50, 50, 10)).toBe(0);
  });

  it("returns positive z for score above mean", () => {
    expect(toZScore(60, 50, 10)).toBe(1);
  });

  it("returns negative z for score below mean", () => {
    expect(toZScore(40, 50, 10)).toBe(-1);
  });

  it("returns 0 when sd is 0", () => {
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
  it("returns 50 for z = 0", () => {
    expect(toTScore(0)).toBe(50);
  });

  it("returns 60 for z = 1", () => {
    expect(toTScore(1)).toBe(60);
  });

  it("returns 40 for z = -1", () => {
    expect(toTScore(-1)).toBe(40);
  });

  it("returns 30 for z = -2", () => {
    expect(toTScore(-2)).toBe(30);
  });
});

// ---------------------------------------------------------------------------
// scoreToTScore
// ---------------------------------------------------------------------------

describe("scoreToTScore", () => {
  it("converts raw score to T-score through z", () => {
    expect(scoreToTScore(60, 50, 10)).toBe(60);
    expect(scoreToTScore(50, 50, 10)).toBe(50);
  });

  it("returns 50 when sd is 0", () => {
    expect(scoreToTScore(60, 50, 0)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// toStanine
// ---------------------------------------------------------------------------

describe("toStanine", () => {
  it("returns 1 for very low z-scores", () => {
    expect(toStanine(-2.0)).toBe(1);
  });

  it("returns 5 for z = 0", () => {
    expect(toStanine(0)).toBe(5);
  });

  it("returns 9 for very high z-scores", () => {
    expect(toStanine(2.0)).toBe(9);
  });

  it("classifies boundary values correctly", () => {
    expect(toStanine(-1.75)).toBe(2);
    expect(toStanine(-1.76)).toBe(1);
    expect(toStanine(-1.25)).toBe(3);
    expect(toStanine(-0.75)).toBe(4);
    expect(toStanine(-0.25)).toBe(5);
    expect(toStanine(0.25)).toBe(6);
    expect(toStanine(0.75)).toBe(7);
    expect(toStanine(1.25)).toBe(8);
    expect(toStanine(1.75)).toBe(9);
  });

  it("accepts custom cutpoints", () => {
    const customCuts = [-1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5];
    expect(toStanine(-1.5, customCuts)).toBe(1);
    expect(toStanine(0.0, customCuts)).toBe(4);
    expect(toStanine(3.0, customCuts)).toBe(9);
  });
});

// ---------------------------------------------------------------------------
// scoreToStanine
// ---------------------------------------------------------------------------

describe("scoreToStanine", () => {
  it("converts raw score to stanine through z", () => {
    expect(scoreToStanine(50, 50, 10)).toBe(5);
  });

  it("returns stanine 1 for very low scores", () => {
    expect(scoreToStanine(20, 50, 10)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// toSten
// ---------------------------------------------------------------------------

describe("toSten", () => {
  it("returns 1 for very low z-scores", () => {
    expect(toSten(-2.5)).toBe(1);
  });

  it("returns 6 for z slightly above 0", () => {
    expect(toSten(0.1)).toBe(6);
  });

  it("returns 10 for very high z-scores", () => {
    expect(toSten(2.5)).toBe(10);
  });

  it("classifies boundary values correctly", () => {
    expect(toSten(-2.0)).toBe(2);
    expect(toSten(-2.01)).toBe(1);
    expect(toSten(-1.5)).toBe(3);
    expect(toSten(-1.0)).toBe(4);
    expect(toSten(-0.5)).toBe(5);
    expect(toSten(0.0)).toBe(6);
    expect(toSten(0.5)).toBe(7);
    expect(toSten(1.0)).toBe(8);
    expect(toSten(1.5)).toBe(9);
    expect(toSten(2.0)).toBe(10);
  });

  it("accepts custom cutpoints", () => {
    const customCuts = [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0, 2.5];
    expect(toSten(-2.0, customCuts)).toBe(1);
    expect(toSten(0.0, customCuts)).toBe(5);
    expect(toSten(3.0, customCuts)).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// scoreToSten
// ---------------------------------------------------------------------------

describe("scoreToSten", () => {
  it("converts raw score to sten through z", () => {
    expect(scoreToSten(50, 50, 10)).toBe(6);
  });

  it("returns sten 1 for very low scores", () => {
    expect(scoreToSten(20, 50, 10)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// toPercentile
// ---------------------------------------------------------------------------

describe("toPercentile", () => {
  it("returns 50 for z = 0", () => {
    expect(toPercentile(0)).toBe(50);
  });

  it("returns high percentile for z = 2", () => {
    expect(toPercentile(2)).toBe(98);
  });

  it("returns low percentile for z = -2", () => {
    expect(toPercentile(-2)).toBe(2);
  });

  it("clamps at 1 for extreme negative z", () => {
    expect(toPercentile(-10)).toBe(1);
  });

  it("clamps at 99 for extreme positive z", () => {
    expect(toPercentile(10)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// scoreToPercentile
// ---------------------------------------------------------------------------

describe("scoreToPercentile", () => {
  it("converts raw score to percentile through z", () => {
    expect(scoreToPercentile(50, 50, 10)).toBe(50);
  });

  it("returns high percentile for scores well above mean", () => {
    expect(scoreToPercentile(70, 50, 10)).toBeGreaterThan(90);
  });
});

// ---------------------------------------------------------------------------
// normalCDF
// ---------------------------------------------------------------------------

describe("normalCDF", () => {
  it("returns ~0.5 for z = 0", () => {
    expect(normalCDF(0)).toBeCloseTo(0.5, 4);
  });

  it("returns ~0.8413 for z = 1", () => {
    expect(normalCDF(1)).toBeCloseTo(0.8413, 3);
  });

  it("returns ~0.1587 for z = -1", () => {
    expect(normalCDF(-1)).toBeCloseTo(0.1587, 3);
  });

  it("returns 0 for z < -8", () => {
    expect(normalCDF(-9)).toBe(0);
  });

  it("returns 1 for z > 8", () => {
    expect(normalCDF(9)).toBe(1);
  });

  it("is symmetric around 0.5", () => {
    const z = 1.5;
    expect(normalCDF(z) + normalCDF(-z)).toBeCloseTo(1, 5);
  });
});

// ---------------------------------------------------------------------------
// normalQuantile
// ---------------------------------------------------------------------------

describe("normalQuantile", () => {
  it("returns 0 for p = 0.5", () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 2);
  });

  it("returns ~1.96 for p = 0.975", () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.96, 1);
  });

  it("returns ~-1.96 for p = 0.025", () => {
    expect(normalQuantile(0.025)).toBeCloseTo(-1.96, 1);
  });

  it("returns -Infinity for p <= 0", () => {
    expect(normalQuantile(0)).toBe(-Infinity);
  });

  it("returns Infinity for p >= 1", () => {
    expect(normalQuantile(1)).toBe(Infinity);
  });

  it("returns negative value for p < 0.5", () => {
    expect(normalQuantile(0.1)).toBeLessThan(0);
  });

  it("returns positive value for p > 0.5", () => {
    expect(normalQuantile(0.9)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// buildScoreRepresentations
// ---------------------------------------------------------------------------

describe("buildScoreRepresentations", () => {
  const norms: NormParameters = {
    mean: 50,
    sd: 10,
    normGroupId: "norm-1",
  };

  it("builds raw and POMP without norms", () => {
    const result = buildScoreRepresentations(3, 5, 1);
    expect(result.raw).toBe(3);
    expect(result.rawMax).toBe(5);
    expect(result.pomp).toBe(50);
    expect(result.zScore).toBeUndefined();
    expect(result.tScore).toBeUndefined();
    expect(result.stanine).toBeUndefined();
    expect(result.sten).toBeUndefined();
    expect(result.percentile).toBeUndefined();
    expect(result.normGroupId).toBeUndefined();
  });

  it("includes norm-referenced scores when norms are provided", () => {
    const result = buildScoreRepresentations(5, 5, 1, norms);
    expect(result.pomp).toBe(100);
    expect(result.zScore).toBe(5);
    expect(result.tScore).toBe(100);
    expect(result.stanine).toBe(9);
    expect(result.sten).toBe(10);
    expect(result.percentile).toBe(99);
    expect(result.normGroupId).toBe("norm-1");
  });

  it("skips norm-referenced scores when norms.sd is 0", () => {
    const zeroSdNorms: NormParameters = { mean: 50, sd: 0, normGroupId: "n" };
    const result = buildScoreRepresentations(3, 5, 1, zeroSdNorms);
    expect(result.zScore).toBeUndefined();
    expect(result.tScore).toBeUndefined();
  });

  it("defaults rawMin to 0", () => {
    const result = buildScoreRepresentations(50, 100);
    expect(result.pomp).toBe(50);
  });

  it("uses custom stanine and sten cutpoints from norms", () => {
    const customNorms: NormParameters = {
      mean: 50,
      sd: 10,
      normGroupId: "custom",
      stanineCutpoints: [-1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0],
      stenCutpoints: [-1.8, -1.3, -0.8, -0.3, 0.2, 0.7, 1.2, 1.7, 2.2],
    };
    const result = buildScoreRepresentations(50, 100, 0, customNorms);
    expect(result.stanine).toBeDefined();
    expect(result.sten).toBeDefined();
  });

  it("includes confidence interval when se is provided", () => {
    const result = buildScoreRepresentations(3, 5, 1, undefined, 5);
    expect(result.standardError).toBe(5);
    expect(result.confidence).toBeDefined();
    expect(result.confidence!.level).toBe(0.95);
    expect(result.confidence!.lower).toBeLessThan(result.pomp);
    expect(result.confidence!.upper).toBeGreaterThan(result.pomp);
  });

  it("uses custom confidence level", () => {
    const result = buildScoreRepresentations(3, 5, 1, undefined, 5, 0.9);
    expect(result.confidence!.level).toBe(0.9);
    const width90 = result.confidence!.upper - result.confidence!.lower;

    const result95 = buildScoreRepresentations(3, 5, 1, undefined, 5, 0.95);
    const width95 = result95.confidence!.upper - result95.confidence!.lower;
    expect(width95).toBeGreaterThan(width90);
  });

  it("skips confidence interval when se is 0", () => {
    const result = buildScoreRepresentations(3, 5, 1, undefined, 0);
    expect(result.confidence).toBeUndefined();
    expect(result.standardError).toBeUndefined();
  });

  it("skips confidence interval when se is undefined", () => {
    const result = buildScoreRepresentations(3, 5, 1);
    expect(result.confidence).toBeUndefined();
    expect(result.standardError).toBeUndefined();
  });

  it("includes both norms and confidence when both provided", () => {
    const result = buildScoreRepresentations(3, 5, 1, norms, 3, 0.95);
    expect(result.zScore).toBeDefined();
    expect(result.tScore).toBeDefined();
    expect(result.confidence).toBeDefined();
    expect(result.standardError).toBe(3);
  });
});
