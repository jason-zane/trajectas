/**
 * Scoring pipeline — full construct → factor → dimension rollup.
 *
 * Implements the scoring flow described in the assessment architecture:
 *
 * ```
 * Responses
 *   → Reverse-score where flagged
 *   → Score per item (raw value)
 *   → Normalise per item (POMP for cross-format; raw preserved separately)
 *   → Group by Construct → Construct score (mean POMP)
 *   → Weighted rollup to Factor (via factor_constructs.weight)
 *   → Simple average to Dimension
 *   → Apply norm transformation if norms available
 *   → Persist all score representations
 * ```
 *
 * Key principles:
 * - Normalisation happens at item level BEFORE aggregation
 * - Construct-level scoring is an explicit intermediate step
 * - Raw scores are always preserved
 * - POMP/norms are transformations, not replacements
 *
 * @module
 */

import type { ScoringMethod } from '@/types/database'
import type {
  ConstructScore,
  FactorScore,
  DimensionScore,
  PipelineOutput,
  ScoreRepresentations,
  NormParameters,
  ScoringItemMeta,
} from '@/types/scoring'
import { toPomp, buildScoreRepresentations } from './transforms'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single response with item metadata. */
export interface ScoredResponse {
  /** Item ID. */
  itemId: string
  /** Raw response value (before reverse-scoring). */
  rawValue: number
  /** Effective value after reverse-scoring. */
  effectiveValue: number
  /** POMP-normalised value (0-100). */
  pompValue: number
}

/** Factor-construct relationship with weight. */
export interface FactorConstructLink {
  factorId: string
  constructId: string
  weight: number
}

/** Factor-dimension relationship. */
export interface FactorDimensionLink {
  factorId: string
  dimensionId: string
}

/** Full pipeline configuration. */
export interface PipelineConfig {
  /** Candidate session ID. */
  sessionId: string
  /** Assessment ID. */
  assessmentId: string
  /** Scoring method. */
  scoringMethod: ScoringMethod
  /** Item metadata keyed by item ID. */
  items: Map<string, ScoringItemMeta>
  /** Factor-construct links with weights. */
  factorConstructLinks: FactorConstructLink[]
  /** Factor-dimension links. */
  factorDimensionLinks: FactorDimensionLink[]
  /** Factor names for reporting. */
  factorNames?: Map<string, string>
  /** Construct names for reporting. */
  constructNames?: Map<string, string>
  /** Dimension names for reporting. */
  dimensionNames?: Map<string, string>
  /** Norm parameters per construct (keyed by construct ID). */
  constructNorms?: Map<string, NormParameters>
}

// ---------------------------------------------------------------------------
// Step 1: Score and normalise items
// ---------------------------------------------------------------------------

/**
 * Score individual items: apply reverse-scoring and compute POMP.
 *
 * @param responses - Raw response values keyed by item ID.
 * @param items     - Item metadata map.
 * @returns Array of scored responses.
 */
export function scoreItems(
  responses: Map<string, number>,
  items: Map<string, ScoringItemMeta>,
): ScoredResponse[] {
  const scored: ScoredResponse[] = []

  for (const [itemId, rawValue] of responses) {
    const meta = items.get(itemId)
    if (!meta) continue

    const effectiveValue = meta.reverseScored
      ? meta.maxValue - rawValue + meta.minValue
      : rawValue

    const pompValue = toPomp(effectiveValue, meta.minValue, meta.maxValue)

    scored.push({
      itemId,
      rawValue,
      effectiveValue,
      pompValue,
    })
  }

  return scored
}

// ---------------------------------------------------------------------------
// Step 2: Aggregate to constructs
// ---------------------------------------------------------------------------

/**
 * Group scored items by construct and compute construct-level scores.
 *
 * Each construct score is the mean POMP of its constituent items.
 * Raw sums are also preserved.
 *
 * @param scoredItems - Items after scoring and POMP normalisation.
 * @param items       - Item metadata map (for construct assignment).
 * @param constructNames - Optional construct name lookup.
 * @param constructNorms - Optional norm parameters per construct.
 * @returns Array of construct-level scores.
 */
export function aggregateToConstructs(
  scoredItems: ScoredResponse[],
  items: Map<string, ScoringItemMeta>,
  constructNames?: Map<string, string>,
  constructNorms?: Map<string, NormParameters>,
): ConstructScore[] {
  // Group by construct
  const byConstruct = new Map<string, ScoredResponse[]>()

  for (const scored of scoredItems) {
    const meta = items.get(scored.itemId)
    if (!meta) continue

    const existing = byConstruct.get(meta.constructId)
    if (existing) {
      existing.push(scored)
    } else {
      byConstruct.set(meta.constructId, [scored])
    }
  }

  // Compute construct scores
  const results: ConstructScore[] = []

  for (const [constructId, responses] of byConstruct) {
    const itemIds = responses.map((r) => r.itemId)
    const pompValues = responses.map((r) => r.pompValue)
    const rawValues = responses.map((r) => r.effectiveValue)

    const meanPomp = pompValues.reduce((s, v) => s + v, 0) / pompValues.length
    const rawSum = rawValues.reduce((s, v) => s + v, 0)

    // Compute raw max for this construct's items
    let rawMax = 0
    for (const r of responses) {
      const meta = items.get(r.itemId)
      if (meta) rawMax += meta.maxValue
    }

    const norms = constructNorms?.get(constructId)
    const scores = buildScoreRepresentations(rawSum, rawMax, 0, norms)
    // Override POMP with the mean of item-level POMPs (more accurate for mixed formats)
    scores.pomp = meanPomp

    results.push({
      constructId,
      constructName: constructNames?.get(constructId),
      scores,
      itemCount: responses.length,
      itemIds,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Step 3: Weighted rollup to factors
// ---------------------------------------------------------------------------

/**
 * Compute factor scores via weighted rollup from construct scores.
 *
 * For each factor, the score is the weighted mean of its constituent
 * construct POMP scores, using the weights from `factor_constructs`.
 *
 * @param constructScores    - Construct-level scores.
 * @param factorConstructLinks - Factor-construct relationships with weights.
 * @param factorNames        - Optional factor name lookup.
 * @param scoringMethod      - The scoring method being used.
 * @returns Array of factor-level scores.
 */
export function aggregateToFactors(
  constructScores: ConstructScore[],
  factorConstructLinks: FactorConstructLink[],
  factorNames?: Map<string, string>,
  scoringMethod: ScoringMethod = 'ctt',
): FactorScore[] {
  // Index construct scores by ID
  const constructScoreMap = new Map<string, ConstructScore>()
  for (const cs of constructScores) {
    constructScoreMap.set(cs.constructId, cs)
  }

  // Group links by factor
  const linksByFactor = new Map<string, FactorConstructLink[]>()
  for (const link of factorConstructLinks) {
    const existing = linksByFactor.get(link.factorId)
    if (existing) {
      existing.push(link)
    } else {
      linksByFactor.set(link.factorId, [link])
    }
  }

  const results: FactorScore[] = []

  for (const [factorId, links] of linksByFactor) {
    let weightedSum = 0
    let totalWeight = 0
    let totalItems = 0
    let rawSum = 0
    let rawMaxSum = 0

    for (const link of links) {
      const cs = constructScoreMap.get(link.constructId)
      if (!cs) continue

      weightedSum += cs.scores.pomp * link.weight
      totalWeight += link.weight
      totalItems += cs.itemCount
      rawSum += cs.scores.raw
      rawMaxSum += cs.scores.rawMax
    }

    if (totalWeight === 0) continue

    const scaledScore = weightedSum / totalWeight
    const rawScore = rawSum

    results.push({
      factorId,
      factorName: factorNames?.get(factorId) ?? factorId,
      rawScore,
      scaledScore,
      scoringMethod,
      itemsUsed: totalItems,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Step 4: Simple average to dimensions
// ---------------------------------------------------------------------------

/**
 * Compute dimension scores as the simple average of their factor scores.
 *
 * @param factorScores       - Factor-level scores.
 * @param factorDimensionLinks - Which factors belong to which dimensions.
 * @param dimensionNames     - Optional dimension name lookup.
 * @returns Array of dimension-level scores.
 */
export function aggregateToDimensions(
  factorScores: FactorScore[],
  factorDimensionLinks: FactorDimensionLink[],
  dimensionNames?: Map<string, string>,
): DimensionScore[] {
  // Index factor scores by ID
  const factorScoreMap = new Map<string, FactorScore>()
  for (const fs of factorScores) {
    factorScoreMap.set(fs.factorId, fs)
  }

  // Group links by dimension
  const linksByDimension = new Map<string, string[]>()
  for (const link of factorDimensionLinks) {
    const existing = linksByDimension.get(link.dimensionId)
    if (existing) {
      existing.push(link.factorId)
    } else {
      linksByDimension.set(link.dimensionId, [link.factorId])
    }
  }

  const results: DimensionScore[] = []

  for (const [dimensionId, factorIds] of linksByDimension) {
    const relevantFactorScores: FactorScore[] = []
    let pompSum = 0
    let rawSum = 0
    let rawMaxSum = 0

    for (const factorId of factorIds) {
      const fs = factorScoreMap.get(factorId)
      if (!fs) continue
      relevantFactorScores.push(fs)
      pompSum += fs.scaledScore
      rawSum += fs.rawScore
    }

    if (relevantFactorScores.length === 0) continue

    const meanPomp = pompSum / relevantFactorScores.length

    // Build score representations with POMP as the primary scale
    const scores: ScoreRepresentations = {
      raw: rawSum,
      rawMax: rawMaxSum || rawSum, // fallback
      pomp: meanPomp,
    }

    results.push({
      dimensionId,
      dimensionName: dimensionNames?.get(dimensionId),
      scores,
      factorScores: relevantFactorScores,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Full pipeline
// ---------------------------------------------------------------------------

/**
 * Execute the complete scoring pipeline for a candidate session.
 *
 * @param responses - Raw response values keyed by item ID.
 * @param config    - Pipeline configuration.
 * @returns Full pipeline output with scores at all taxonomy levels.
 */
export function runScoringPipeline(
  responses: Map<string, number>,
  config: PipelineConfig,
): PipelineOutput {
  // Step 1: Score and normalise items
  const scoredItems = scoreItems(responses, config.items)

  // Step 2: Aggregate to constructs
  const constructScores = aggregateToConstructs(
    scoredItems,
    config.items,
    config.constructNames,
    config.constructNorms,
  )

  // Step 3: Weighted rollup to factors
  const factorScores = aggregateToFactors(
    constructScores,
    config.factorConstructLinks,
    config.factorNames,
    config.scoringMethod,
  )

  // Step 4: Simple average to dimensions
  const dimensionScores = aggregateToDimensions(
    factorScores,
    config.factorDimensionLinks,
    config.dimensionNames,
  )

  return {
    sessionId: config.sessionId,
    assessmentId: config.assessmentId,
    constructScores,
    factorScores,
    dimensionScores,
    scoringMethod: config.scoringMethod,
    scoredAt: new Date().toISOString(),
  }
}
