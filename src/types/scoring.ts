// =============================================================================
// scoring.ts — Types for the psychometric scoring engine
// =============================================================================

import type { IRTModelType, ItemSelectionStrategy, ScoringMethod } from './database'
import type { ItemSelectionRule } from './database'

// ---------------------------------------------------------------------------
// IRT (Item Response Theory) types
// ---------------------------------------------------------------------------

/**
 * Calibrated IRT parameters for a single item.
 * These are estimated offline and stored in the `item_parameters` table.
 */
export interface IRTParameters {
  /** Discrimination parameter (a). Higher values mean the item differentiates more sharply between ability levels. */
  discrimination: number
  /** Difficulty parameter (b). Located on the same theta scale as candidate ability. */
  difficulty: number
  /** Pseudo-guessing parameter (c). Lower asymptote — the probability of a correct answer by pure guessing. */
  guessing: number
  /** The IRT model variant these parameters were calibrated under. */
  modelType: IRTModelType
}

/**
 * A candidate's response to a single item, formatted for the IRT scoring engine.
 */
export interface IRTResponse {
  /** UUID of the item that was answered. */
  itemId: string
  /** Numeric value of the candidate's response (e.g. 0 or 1 for dichotomous items). */
  responseValue: number
  /** Time in milliseconds the candidate spent on this item (optional; used for response-time modelling). */
  responseTime?: number
}

/**
 * A point estimate of a candidate's latent ability (theta) on a single trait,
 * produced by the IRT estimation algorithm (e.g. MLE, EAP, MAP).
 */
export interface IRTEstimate {
  /** Estimated ability on the theta scale (typically -4 to +4). */
  theta: number
  /** Standard error of the theta estimate. Lower = more precise. */
  standardError: number
  /** Confidence interval around the theta estimate (default 95 %). */
  confidence: {
    /** Lower bound of the confidence interval. */
    lower: number
    /** Upper bound of the confidence interval. */
    upper: number
  }
}

/**
 * Result of scoring a set of responses using Classical Test Theory.
 * CTT is simpler than IRT but useful for fixed-form assessments.
 */
export interface CTTScoreResult {
  /** Sum of response values across all items. */
  rawScore: number
  /** Maximum possible raw score. */
  maxPossible: number
  /** Percentage score (rawScore / maxPossible * 100). */
  percentage: number
  /** Mean score from the norm group, if available. */
  mean?: number
  /** Standard deviation from the norm group, if available. */
  standardDeviation?: number
}

// ---------------------------------------------------------------------------
// CAT (Computerised Adaptive Testing) types
// ---------------------------------------------------------------------------

/**
 * Tuning parameters that govern the adaptive testing algorithm's
 * stopping rules and item selection boundaries.
 */
export interface CATConfig {
  /** Maximum number of items to administer before forced termination. */
  maxItems: number
  /** Minimum number of items required before the SE stopping rule can trigger. */
  minItems: number
  /**
   * Standard error threshold. The CAT terminates once SE drops below this value,
   * indicating sufficient measurement precision.
   */
  seThreshold: number
  /** Upper boundary of the theta search space. */
  maxTheta: number
  /** Lower boundary of the theta search space. */
  minTheta: number
}

/**
 * The mutable state of a CAT session for one candidate on one trait.
 * Updated after every response.
 */
export interface CATState {
  /** Current theta estimate based on all responses so far. */
  currentTheta: number
  /** Current standard error of the theta estimate. */
  standardError: number
  /** Ordered list of item IDs already administered. */
  itemsAdministered: string[]
  /** Full response record for items administered so far. */
  responses: IRTResponse[]
  /** UUID of the next item to present, or undefined if the session is complete. */
  nextItemId?: string
  /** Whether the adaptive session has reached a termination condition. */
  isComplete: boolean
  /**
   * Human-readable reason for termination (e.g. "SE threshold reached",
   * "maximum items administered", "item pool exhausted").
   */
  terminationReason?: string
}

// ---------------------------------------------------------------------------
// Item selection configuration
// ---------------------------------------------------------------------------

/**
 * Top-level configuration that tells the item-selection engine which
 * strategy to use and supplies the relevant sub-configuration.
 */
export interface AdaptiveItemSelectionConfig {
  /** The selection strategy in effect. */
  strategy: ItemSelectionStrategy
  /**
   * Business rules applied when `strategy` is `rule_based`.
   * Evaluated in priority order; the first matching rule wins.
   */
  rules?: ItemSelectionRule[]
  /**
   * CAT algorithm parameters, required when `strategy` is `cat`.
   */
  catConfig?: CATConfig
}

// ---------------------------------------------------------------------------
// Factor-level scoring output
// ---------------------------------------------------------------------------

/**
 * The final score for a single factor within a candidate's assessment session.
 * This is the primary unit reported on score reports and dashboards.
 */
export interface FactorScore {
  /** UUID of the factor. */
  factorId: string
  /** Human-readable factor name. */
  factorName: string
  /** Unscaled raw score (sum or IRT theta, depending on method). */
  rawScore: number
  /** Score transformed to the reporting scale (e.g. 0–100 or stanine). */
  scaledScore: number
  /** Percentile rank relative to the norm group, if a norm table is available. */
  percentile?: number
  /** Confidence interval around the scaled score. */
  confidence?: {
    /** Lower bound. */
    lower: number
    /** Upper bound. */
    upper: number
  }
  /** The scoring algorithm that produced this result. */
  scoringMethod: ScoringMethod
  /** Number of items that contributed to this score. */
  itemsUsed: number
}

// ---------------------------------------------------------------------------
// Scoring engine input / output aggregates
// ---------------------------------------------------------------------------

/**
 * Input bundle sent to the scoring engine for a complete candidate session.
 * Contains all the data needed to produce factor scores.
 */
export interface ScoringEngineInput {
  /** UUID of the candidate session. */
  sessionId: string
  /** UUID of the assessment definition. */
  assessmentId: string
  /** Which scoring method to apply. */
  scoringMethod: ScoringMethod
  /** All responses collected during the session. */
  responses: IRTResponse[]
  /**
   * Map from factor ID to the item IDs that belong to that factor,
   * used to partition responses for per-factor scoring.
   */
  factorItemMap: Record<string, string[]>
  /**
   * Map from item ID to its calibrated IRT parameters.
   * Only required when `scoringMethod` is `irt` or `hybrid`.
   */
  itemParameters?: Record<string, IRTParameters>
  /**
   * Map from factor ID to its weight within the assessment.
   * Used for computing weighted composite scores.
   */
  factorWeights?: Record<string, number>
}

/**
 * Complete output of the scoring engine for a candidate session.
 */
export interface ScoringEngineOutput {
  /** UUID of the candidate session that was scored. */
  sessionId: string
  /** Per-factor score results. */
  factorScores: FactorScore[]
  /**
   * Optional weighted composite score across all factors.
   * Only computed when factor weights are provided.
   */
  compositeScore?: number
  /** ISO-8601 timestamp of when scoring completed. */
  scoredAt: string
}
