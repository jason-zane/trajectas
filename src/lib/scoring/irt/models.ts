/**
 * IRT (Item Response Theory) probability and information functions.
 *
 * Implements the three classical unidimensional dichotomous IRT models:
 *
 * | Model | Parameters          | Use-case                          |
 * |-------|---------------------|-----------------------------------|
 * | 1PL   | b (difficulty)      | Rasch measurement; equal discrim. |
 * | 2PL   | a (discrimination), b | Most operational item banks      |
 * | 3PL   | a, b, c (guessing)  | Multiple-choice with guessing     |
 *
 * All functions assume the standard logistic metric (D = 1).
 * Multiply the exponent by D = 1.7 to approximate the normal ogive.
 *
 * @module
 */

import type { IRTParameters } from '@/types/scoring'

// ---------------------------------------------------------------------------
// Probability functions
// ---------------------------------------------------------------------------

/**
 * One-parameter logistic (Rasch) model.
 *
 * ```
 * P(theta) = 1 / (1 + exp(-(theta - b)))
 * ```
 *
 * The Rasch model assumes equal discrimination across all items
 * (a = 1) and no guessing (c = 0).  It is the foundation of
 * Rasch measurement theory, which prioritises specific objectivity.
 *
 * @param theta - Examinee ability on the latent trait scale.
 * @param b     - Item difficulty (location on the theta scale where P = 0.5).
 * @returns Probability of a correct response, in [0, 1].
 */
export function probability1PL(theta: number, b: number): number {
  return 1 / (1 + Math.exp(-(theta - b)))
}

/**
 * Two-parameter logistic model.
 *
 * ```
 * P(theta) = 1 / (1 + exp(-a(theta - b)))
 * ```
 *
 * Extends the Rasch model by allowing each item to have its own
 * discrimination parameter `a`.  Items with higher `a` values
 * provide more information near their difficulty level.
 *
 * @param theta - Examinee ability.
 * @param a     - Item discrimination (slope at the inflection point).
 * @param b     - Item difficulty.
 * @returns Probability of a correct response, in [0, 1].
 */
export function probability2PL(theta: number, a: number, b: number): number {
  return 1 / (1 + Math.exp(-a * (theta - b)))
}

/**
 * Three-parameter logistic model.
 *
 * ```
 * P(theta) = c + (1 - c) / (1 + exp(-a(theta - b)))
 * ```
 *
 * Adds a lower asymptote `c` to account for the probability that
 * even very low-ability examinees can answer correctly by guessing.
 * For a 4-option multiple-choice item, c ~ 0.25 is a common prior.
 *
 * @param theta - Examinee ability.
 * @param a     - Item discrimination.
 * @param b     - Item difficulty.
 * @param c     - Pseudo-guessing (lower asymptote), in [0, 1).
 * @returns Probability of a correct response, in [c, 1].
 */
export function probability3PL(
  theta: number,
  a: number,
  b: number,
  c: number,
): number {
  return c + (1 - c) / (1 + Math.exp(-a * (theta - b)))
}

// ---------------------------------------------------------------------------
// Unified probability dispatcher
// ---------------------------------------------------------------------------

/**
 * Compute the probability of a correct response for an item using
 * whichever IRT model its parameters specify.
 *
 * This is the preferred entry point when working with heterogeneous
 * item banks where different items may use different models.
 *
 * @param theta  - Examinee ability.
 * @param params - Full item parameter object (uses `discrimination`,
 *                 `difficulty`, `guessing`, and `modelType` fields).
 * @returns Probability of a correct response.
 */
export function probability(theta: number, params: IRTParameters): number {
  const a = params.discrimination
  const b = params.difficulty
  const c = params.guessing

  switch (params.modelType) {
    case '1PL':
      return probability1PL(theta, b)
    case '2PL':
      return probability2PL(theta, a, b)
    case '3PL':
      return probability3PL(theta, a, b, c)
    default: {
      // Exhaustiveness check — TypeScript should prevent this at compile time.
      const _exhaustive: never = params.modelType
      throw new Error(`Unknown IRT model: ${_exhaustive}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Information functions
// ---------------------------------------------------------------------------

/**
 * Fisher information for a single item at a given ability level.
 *
 * For the 3PL model the general formula is:
 *
 * ```
 * I(theta) = a^2 * (P - c)^2 * Q / ((1 - c)^2 * P)
 * ```
 *
 * where P = P(theta) and Q = 1 - P.
 *
 * For 1PL and 2PL (c = 0) this simplifies to `a^2 * P * Q`.
 *
 * Item information quantifies how much an item contributes to the
 * precision of the ability estimate at a particular theta.  Items are
 * most informative near their difficulty level.
 *
 * @param theta  - Examinee ability.
 * @param params - Item parameters.
 * @returns Fisher information value (>= 0).
 */
export function itemInformation(theta: number, params: IRTParameters): number {
  const a = params.discrimination
  const c = params.guessing
  const p = probability(theta, params)
  const q = 1 - p

  // Guard against division by zero when P is extremely close to 0.
  if (p < 1e-15) return 0

  if (c === 0) {
    // Simplified formula for 1PL / 2PL.
    return a * a * p * q
  }

  // General 3PL formula.
  const numerator = a * a * Math.pow(p - c, 2) * q
  const denominator = Math.pow(1 - c, 2) * p
  return numerator / denominator
}

/**
 * Total test information at a given ability level.
 *
 * Under the assumption of local independence, test information is
 * simply the sum of item information values across all items:
 *
 * ```
 * I_test(theta) = sum of I_i(theta)
 * ```
 *
 * @param theta - Examinee ability.
 * @param items - Array of item parameter objects.
 * @returns Total information (>= 0).
 */
export function testInformation(theta: number, items: IRTParameters[]): number {
  return items.reduce((sum, item) => sum + itemInformation(theta, item), 0)
}

/**
 * Standard error of the ability estimate at a given theta.
 *
 * The standard error is the reciprocal square root of test information:
 *
 * ```
 * SE(theta) = 1 / sqrt(I_test(theta))
 * ```
 *
 * When test information is zero (no items or theta is far from all item
 * difficulties), SE is theoretically infinite.  In that case we return
 * `Infinity` so callers can detect the degenerate situation.
 *
 * @param theta - Examinee ability.
 * @param items - Array of item parameter objects.
 * @returns Standard error of the estimate.
 */
export function standardError(theta: number, items: IRTParameters[]): number {
  const info = testInformation(theta, items)
  if (info <= 0) return Infinity
  return 1 / Math.sqrt(info)
}
