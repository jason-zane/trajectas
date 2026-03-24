/**
 * Talent Fit scoring engines — unified entry point.
 *
 * Aggregates all three psychometric scoring modules:
 *
 * - **IRT** — Item Response Theory probability models, information
 *   functions, and ability estimation (MLE & EAP).
 * - **CTT** — Classical Test Theory raw/weighted scoring, reliability
 *   (Cronbach's alpha, split-half), and standard error of measurement.
 * - **Adaptive** — Computerized Adaptive Testing engine and rule-based
 *   item selection.
 *
 * @example
 * ```ts
 * import * as scoring from '@/lib/scoring'
 *
 * // IRT
 * const p = scoring.probability2PL(1.5, 1.2, 0.0)
 *
 * // CTT
 * const result = scoring.calculateRawScore(responses)
 *
 * // CAT
 * const engine = new scoring.CATEngine(config, pool)
 * ```
 *
 * @module
 */

// IRT
export {
  probability1PL,
  probability2PL,
  probability3PL,
  probability,
  itemInformation,
  testInformation,
  standardError,
  estimateMLE,
  estimateEAP,
} from './irt'

// CTT
export {
  calculateRawScore,
  calculateWeightedScore,
  calculateReliability,
  calculateStandardError,
} from './ctt'

// Adaptive
export {
  CATEngine,
  calculateItemsPerCompetency,
  selectItems,
  parseCompetencyCountRule,
} from './adaptive'
