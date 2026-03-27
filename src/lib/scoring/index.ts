/**
 * Talent Fit scoring engines — unified entry point.
 *
 * Aggregates all psychometric scoring modules:
 *
 * - **IRT** — Item Response Theory probability models, information
 *   functions, and ability estimation (MLE & EAP).
 * - **CTT** — Classical Test Theory raw/weighted scoring, reliability
 *   (Cronbach's alpha, split-half), and standard error of measurement.
 * - **Adaptive** — Computerized Adaptive Testing engine and rule-based
 *   item selection.
 * - **Transforms** — Score transformation functions (POMP, T-score,
 *   stanine, sten, percentile, normal distribution helpers).
 * - **Item Statistics** — CTT item-level quality metrics (difficulty,
 *   discrimination, alpha-if-deleted, distractor analysis).
 * - **Pipeline** — Full construct → factor → dimension scoring pipeline
 *   with POMP normalisation and weighted rollup.
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
 *
 * // Transforms
 * const pomp = scoring.toPomp(4, 1, 5)  // → 75
 * const t = scoring.scoreToTScore(pomp, 50, 10) // → T-score
 *
 * // Item Statistics
 * const stats = scoring.computeItemStatistics(matrix)
 *
 * // Pipeline
 * const output = scoring.runScoringPipeline(responses, config)
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
  calculateItemsPerFactor,
  selectItems,
  parseFactorCountRule,
} from './adaptive'

// Score transforms
export {
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
} from './transforms'

// Item statistics
export {
  buildResponseMatrix,
  itemDifficulty,
  correctedItemTotalCorrelation,
  alphaIfDeleted,
  responseDistribution,
  distractorAnalysis,
  computeItemStatistics,
} from './item-statistics'

// Scoring pipeline
export {
  scoreItems,
  aggregateToConstructs,
  aggregateToFactors,
  aggregateToDimensions,
  runScoringPipeline,
} from './pipeline'
