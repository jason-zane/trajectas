/**
 * Classical Test Theory (CTT) scoring functions.
 *
 * CTT is the traditional psychometric framework where an observed score
 * is modelled as the sum of a true score and random error:
 *
 * ```
 * X = T + E
 * ```
 *
 * This module provides:
 *
 * - **Raw and weighted scoring** with reverse-scoring support.
 * - **Reliability estimation** via Cronbach's alpha and split-half
 *   (Spearman-Brown corrected).
 * - **Standard Error of Measurement (SEM)** derived from reliability.
 *
 * @module
 */

import type { CTTScoreResult } from '@/types/scoring'

// ---------------------------------------------------------------------------
// Response types (local to this module — not persisted)
// ---------------------------------------------------------------------------

/** A single item response for raw scoring. */
export interface CTTResponseItem {
  /** Observed score value for this item. */
  value: number
  /** Maximum possible value for this item. */
  maxValue: number
  /** If true, the item is reverse-scored: effective = maxValue - value. */
  reverseScored?: boolean
}

/** A single item response for weighted scoring. */
export interface CTTWeightedResponseItem extends CTTResponseItem {
  /** Relative weight applied to this item's contribution. */
  weight: number
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Compute an unweighted raw score from a set of item responses.
 *
 * Reverse-scored items are automatically flipped before summation.
 * For a Likert item scored 1-5, reverse scoring maps
 * 1->5, 2->4, 3->3, 4->2, 5->1 (i.e. `maxValue - value`).
 *
 * @param responses - Array of item response objects.
 * @returns The raw score, max possible, and percentage.
 */
export function calculateRawScore(
  responses: { value: number; maxValue: number; reverseScored?: boolean }[],
): CTTScoreResult {
  if (responses.length === 0) {
    return { rawScore: 0, maxPossible: 0, percentage: 0 }
  }

  let rawScore = 0
  let maxPossible = 0

  for (const item of responses) {
    const effectiveValue = item.reverseScored
      ? item.maxValue - item.value
      : item.value

    rawScore += effectiveValue
    maxPossible += item.maxValue
  }

  const percentage = maxPossible > 0 ? (rawScore / maxPossible) * 100 : 0

  return {
    rawScore,
    maxPossible,
    percentage,
  }
}

/**
 * Compute a weighted score from a set of item responses.
 *
 * Each item's contribution to both the raw score and the max possible
 * is multiplied by its weight.  This is useful when certain items or
 * competencies carry different importance in the assessment.
 *
 * ```
 * score = sum( weight_i * effective_value_i )
 * max   = sum( weight_i * maxValue_i )
 * ```
 *
 * @param responses - Array of weighted item response objects.
 * @returns The weighted score, max possible, and percentage.
 */
export function calculateWeightedScore(
  responses: { value: number; maxValue: number; weight: number; reverseScored?: boolean }[],
): CTTScoreResult {
  if (responses.length === 0) {
    return { rawScore: 0, maxPossible: 0, percentage: 0 }
  }

  let rawScore = 0
  let maxPossible = 0

  for (const item of responses) {
    const effectiveValue = item.reverseScored
      ? item.maxValue - item.value
      : item.value

    rawScore += item.weight * effectiveValue
    maxPossible += item.weight * item.maxValue
  }

  const percentage = maxPossible > 0 ? (rawScore / maxPossible) * 100 : 0

  return {
    rawScore,
    maxPossible,
    percentage,
  }
}

// ---------------------------------------------------------------------------
// Reliability
// ---------------------------------------------------------------------------

/**
 * Estimate internal consistency reliability from a persons x items matrix.
 *
 * Returns two classical indices:
 *
 * ### Cronbach's Alpha
 *
 * ```
 * alpha = (k / (k - 1)) * (1 - sum(sigma_i^2) / sigma_total^2)
 * ```
 *
 * where k is the number of items, sigma_i^2 is the variance of item i,
 * and sigma_total^2 is the variance of the total scores.  Alpha estimates
 * the proportion of total variance that is attributable to the true score.
 *
 * ### Split-Half Reliability (Spearman-Brown corrected)
 *
 * The item set is split into odd- and even-numbered items.  The
 * Pearson correlation between half-scores is then "stepped up" to
 * full-test length using the Spearman-Brown prophecy formula:
 *
 * ```
 * r_full = 2 * r_half / (1 + r_half)
 * ```
 *
 * @param responses - A 2D array where `responses[person][item]` is the
 *                    numeric score for that person on that item.
 * @returns Object containing `cronbachAlpha` and `splitHalfReliability`.
 * @throws If fewer than 2 persons or fewer than 2 items are provided.
 */
export function calculateReliability(
  responses: number[][],
): { cronbachAlpha: number; splitHalfReliability: number } {
  const n = responses.length // persons
  if (n < 2) {
    throw new Error('At least 2 persons are required to compute reliability.')
  }

  const k = responses[0].length // items
  if (k < 2) {
    throw new Error('At least 2 items are required to compute reliability.')
  }

  // Validate that all persons have the same number of items.
  for (let i = 1; i < n; i++) {
    if (responses[i].length !== k) {
      throw new Error(
        `Inconsistent item count: person 0 has ${k} items but person ${i} has ${responses[i].length}.`,
      )
    }
  }

  // ---- Helper: compute mean ----
  const mean = (arr: number[]): number =>
    arr.reduce((s, v) => s + v, 0) / arr.length

  // ---- Helper: compute variance (population) ----
  const variance = (arr: number[]): number => {
    const m = mean(arr)
    return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length
  }

  // ---- Cronbach's Alpha ----

  // Item variances.
  let sumItemVariance = 0
  for (let j = 0; j < k; j++) {
    const itemScores = responses.map((row) => row[j])
    sumItemVariance += variance(itemScores)
  }

  // Total score variance.
  const totalScores = responses.map((row) =>
    row.reduce((s, v) => s + v, 0),
  )
  const totalVariance = variance(totalScores)

  const cronbachAlpha =
    totalVariance > 0
      ? (k / (k - 1)) * (1 - sumItemVariance / totalVariance)
      : 0

  // ---- Split-Half Reliability (odd-even split) ----

  // Compute half-scores for each person.
  const oddScores: number[] = []
  const evenScores: number[] = []

  for (let i = 0; i < n; i++) {
    let odd = 0
    let even = 0
    for (let j = 0; j < k; j++) {
      if (j % 2 === 0) {
        even += responses[i][j]
      } else {
        odd += responses[i][j]
      }
    }
    oddScores.push(odd)
    evenScores.push(even)
  }

  // Pearson correlation between half-scores.
  const rHalf = pearsonCorrelation(oddScores, evenScores)

  // Spearman-Brown prophecy formula.
  const splitHalfReliability =
    1 + rHalf !== 0 ? (2 * rHalf) / (1 + rHalf) : 0

  return { cronbachAlpha, splitHalfReliability }
}

// ---------------------------------------------------------------------------
// Standard Error of Measurement
// ---------------------------------------------------------------------------

/**
 * Standard Error of Measurement (SEM).
 *
 * ```
 * SEM = SD * sqrt(1 - r)
 * ```
 *
 * where SD is the standard deviation of the observed scores and r is
 * the reliability coefficient.  SEM represents the expected standard
 * deviation of an examinee's observed scores around their true score
 * if the test were administered repeatedly.
 *
 * @param _score      - The observed score (not used in the formula but
 *                      included for API context — callers often need it
 *                      alongside the SEM for confidence band construction).
 * @param reliability - Reliability coefficient (e.g. Cronbach's alpha), in [0, 1].
 * @param sd          - Standard deviation of the observed scores.
 * @returns The standard error of measurement.
 */
export function calculateStandardError(
  _score: number,
  reliability: number,
  sd: number,
): number {
  if (reliability < 0 || reliability > 1) {
    throw new Error(
      `Reliability must be between 0 and 1, received ${reliability}.`,
    )
  }
  return sd * Math.sqrt(1 - reliability)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Pearson product-moment correlation coefficient.
 *
 * @param x - First variable.
 * @param y - Second variable (same length as x).
 * @returns Correlation in [-1, 1], or 0 if either variable has zero variance.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = x.length
  if (n !== y.length || n === 0) return 0

  const meanX = x.reduce((s, v) => s + v, 0) / n
  const meanY = y.reduce((s, v) => s + v, 0) / n

  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX
    const dy = y[i] - meanY
    sumXY += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  const denom = Math.sqrt(sumX2 * sumY2)
  return denom > 0 ? sumXY / denom : 0
}
