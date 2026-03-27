/**
 * Score transformation functions.
 *
 * Converts raw scores into standardised scales for cross-format comparison
 * and norm-referenced interpretation. All functions are pure and stateless.
 *
 * | Transform   | Formula                            | Scale    | Prereqs         |
 * |-------------|------------------------------------|----------|-----------------|
 * | POMP        | ((X - min) / (max - min)) × 100    | 0–100    | Scale min/max   |
 * | Z-score     | (X - M) / SD                       | ~-3 to 3 | Norm mean + SD  |
 * | T-score     | 50 + 10 × Z                        | ~20–80   | Norm mean + SD  |
 * | Stanine     | 9-bin from Z cutpoints              | 1–9      | Norm mean + SD  |
 * | Sten        | 10-bin from Z cutpoints             | 1–10     | Norm mean + SD  |
 * | Percentile  | % of norm at or below               | 1–99     | Norm dist.      |
 *
 * @module
 */

import type { ScoreRepresentations, NormParameters } from '@/types/scoring'

// ---------------------------------------------------------------------------
// POMP — Percentage of Maximum Possible
// ---------------------------------------------------------------------------

/**
 * Convert a raw score to POMP (Percentage of Maximum Possible).
 *
 * ```
 * POMP = ((observed - min) / (max - min)) × 100
 * ```
 *
 * POMP puts all scores on a 0–100 scale regardless of the original
 * item format. This enables meaningful aggregation across different
 * response formats (e.g. 5-point Likert + binary).
 *
 * @param observed - The raw score.
 * @param min      - Minimum possible raw score.
 * @param max      - Maximum possible raw score.
 * @returns POMP score in [0, 100].
 */
export function toPomp(observed: number, min: number, max: number): number {
  if (max === min) return 0
  const pomp = ((observed - min) / (max - min)) * 100
  return Math.max(0, Math.min(100, pomp))
}

// ---------------------------------------------------------------------------
// Z-score
// ---------------------------------------------------------------------------

/**
 * Convert a score to a Z-score using norm group parameters.
 *
 * ```
 * Z = (X - M) / SD
 * ```
 *
 * @param score - The observed score (typically POMP).
 * @param mean  - Norm group mean.
 * @param sd    - Norm group standard deviation.
 * @returns Z-score (unbounded, but typically -3 to +3).
 */
export function toZScore(score: number, mean: number, sd: number): number {
  if (sd <= 0) return 0
  return (score - mean) / sd
}

// ---------------------------------------------------------------------------
// T-score
// ---------------------------------------------------------------------------

/**
 * Convert a Z-score to a T-score.
 *
 * ```
 * T = 50 + 10 × Z
 * ```
 *
 * T-scores have a mean of 50 and SD of 10. They avoid negative numbers
 * and are the most common reporting scale in personality assessment.
 *
 * @param zScore - The Z-score to transform.
 * @returns T-score (typically 20–80).
 */
export function toTScore(zScore: number): number {
  return 50 + 10 * zScore
}

/**
 * Convert a raw/POMP score directly to a T-score using norm parameters.
 */
export function scoreToTScore(score: number, mean: number, sd: number): number {
  return toTScore(toZScore(score, mean, sd))
}

// ---------------------------------------------------------------------------
// Stanine (Standard Nine)
// ---------------------------------------------------------------------------

/**
 * Standard Z-score cutpoints for the 9 stanine bins.
 * Each bin corresponds to a specific percentage of the normal distribution:
 * | Stanine | % of pop | Z range         |
 * |---------|----------|-----------------|
 * |    1    |   4%     | < -1.75         |
 * |    2    |   7%     | -1.75 to -1.25  |
 * |    3    |  12%     | -1.25 to -0.75  |
 * |    4    |  17%     | -0.75 to -0.25  |
 * |    5    |  20%     | -0.25 to +0.25  |
 * |    6    |  17%     | +0.25 to +0.75  |
 * |    7    |  12%     | +0.75 to +1.25  |
 * |    8    |   7%     | +1.25 to +1.75  |
 * |    9    |   4%     | > +1.75         |
 */
const STANINE_Z_CUTPOINTS = [-1.75, -1.25, -0.75, -0.25, 0.25, 0.75, 1.25, 1.75]

/**
 * Convert a Z-score to a stanine (1–9).
 *
 * @param zScore - The Z-score to classify.
 * @param cutpoints - Optional custom cutpoints (8 values). Defaults to standard.
 * @returns Stanine value (1–9).
 */
export function toStanine(zScore: number, cutpoints?: number[]): number {
  const cuts = cutpoints ?? STANINE_Z_CUTPOINTS
  for (let i = 0; i < cuts.length; i++) {
    if (zScore < cuts[i]) return i + 1
  }
  return 9
}

/**
 * Convert a raw/POMP score directly to a stanine using norm parameters.
 */
export function scoreToStanine(score: number, mean: number, sd: number): number {
  return toStanine(toZScore(score, mean, sd))
}

// ---------------------------------------------------------------------------
// Sten (Standard Ten)
// ---------------------------------------------------------------------------

/**
 * Standard Z-score cutpoints for the 10 sten bins.
 * Used in 16PF-style instruments for finer classification than stanine.
 */
const STEN_Z_CUTPOINTS = [-2.0, -1.5, -1.0, -0.5, 0.0, 0.5, 1.0, 1.5, 2.0]

/**
 * Convert a Z-score to a sten (1–10).
 *
 * @param zScore - The Z-score to classify.
 * @param cutpoints - Optional custom cutpoints (9 values). Defaults to standard.
 * @returns Sten value (1–10).
 */
export function toSten(zScore: number, cutpoints?: number[]): number {
  const cuts = cutpoints ?? STEN_Z_CUTPOINTS
  for (let i = 0; i < cuts.length; i++) {
    if (zScore < cuts[i]) return i + 1
  }
  return 10
}

/**
 * Convert a raw/POMP score directly to a sten using norm parameters.
 */
export function scoreToSten(score: number, mean: number, sd: number): number {
  return toSten(toZScore(score, mean, sd))
}

// ---------------------------------------------------------------------------
// Percentile rank
// ---------------------------------------------------------------------------

/**
 * Estimate percentile rank from a Z-score using the standard normal CDF
 * approximation (Abramowitz & Stegun, formula 26.2.17).
 *
 * @param zScore - The Z-score.
 * @returns Percentile rank (1–99), clamped.
 */
export function toPercentile(zScore: number): number {
  const percentile = normalCDF(zScore) * 100
  return Math.max(1, Math.min(99, Math.round(percentile)))
}

/**
 * Convert a raw/POMP score directly to a percentile using norm parameters.
 */
export function scoreToPercentile(score: number, mean: number, sd: number): number {
  return toPercentile(toZScore(score, mean, sd))
}

// ---------------------------------------------------------------------------
// Full score representation builder
// ---------------------------------------------------------------------------

/**
 * Build a complete {@link ScoreRepresentations} object from raw inputs.
 *
 * Always computes raw and POMP. Norm-referenced transformations (Z, T,
 * stanine, sten, percentile) are computed only when norm parameters are
 * provided.
 *
 * @param raw       - The raw score value.
 * @param rawMax    - Maximum possible raw score.
 * @param rawMin    - Minimum possible raw score (default 0).
 * @param norms     - Optional norm group parameters.
 * @param se        - Optional standard error of the score.
 * @param ciLevel   - Confidence interval level (default 0.95).
 * @returns Complete score representations.
 */
export function buildScoreRepresentations(
  raw: number,
  rawMax: number,
  rawMin: number = 0,
  norms?: NormParameters,
  se?: number,
  ciLevel: number = 0.95,
): ScoreRepresentations {
  const pomp = toPomp(raw, rawMin, rawMax)

  const result: ScoreRepresentations = {
    raw,
    rawMax,
    pomp,
  }

  if (norms && norms.sd > 0) {
    const z = toZScore(pomp, norms.mean, norms.sd)
    result.zScore = z
    result.tScore = toTScore(z)
    result.stanine = toStanine(z, norms.stanineCutpoints)
    result.sten = toSten(z, norms.stenCutpoints)
    result.percentile = toPercentile(z)
    result.normGroupId = norms.normGroupId
  }

  if (se !== undefined && se > 0) {
    result.standardError = se
    const zMultiplier = normalQuantile(1 - (1 - ciLevel) / 2)
    result.confidence = {
      level: ciLevel,
      lower: pomp - zMultiplier * se,
      upper: pomp + zMultiplier * se,
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Normal distribution helpers
// ---------------------------------------------------------------------------

/**
 * Standard normal CDF approximation.
 * Uses the Abramowitz & Stegun rational approximation (max error < 7.5e-8).
 */
export function normalCDF(z: number): number {
  if (z < -8) return 0
  if (z > 8) return 1

  const negative = z < 0
  if (negative) z = -z

  const p = 0.2316419
  const b1 = 0.319381530
  const b2 = -0.356563782
  const b3 = 1.781477937
  const b4 = -1.821255978
  const b5 = 1.330274429

  const t = 1 / (1 + p * z)
  const pdf = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI)
  const cdf =
    1 - pdf * (b1 * t + b2 * t ** 2 + b3 * t ** 3 + b4 * t ** 4 + b5 * t ** 5)

  return negative ? 1 - cdf : cdf
}

/**
 * Inverse normal CDF (quantile function).
 * Uses the Beasley-Springer-Moro algorithm for reasonable precision.
 *
 * @param p - Probability (0 < p < 1).
 * @returns Z-score corresponding to the given cumulative probability.
 */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity

  // Rational approximation (Abramowitz & Stegun 26.2.23)
  if (p < 0.5) return -normalQuantile(1 - p)

  const t = Math.sqrt(-2 * Math.log(1 - p))
  const c0 = 2.515517
  const c1 = 0.802853
  const c2 = 0.010328
  const d1 = 1.432788
  const d2 = 0.189269
  const d3 = 0.001308

  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t)
}
