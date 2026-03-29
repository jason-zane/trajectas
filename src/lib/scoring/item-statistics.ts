/**
 * Item-level psychometric statistics (CTT).
 *
 * Computes quality metrics for individual items given a response matrix:
 *
 * - **Difficulty (p-value)**: mean score / max score
 * - **Discrimination**: corrected item-total correlation
 * - **Alpha-if-deleted**: Cronbach's alpha with the item removed
 * - **Response distribution**: frequency count per option
 * - **Distractor analysis**: point-biserial correlation per option
 *
 * These statistics are the foundation for item quality monitoring and
 * should be computed once sufficient data accumulates (~200+ responses).
 *
 * @module
 */

import type { CTTItemStatistics, DistractorAnalysis } from '@/types/scoring'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single participant's response to a single item. */
export interface ItemResponse {
  /** Item ID. */
  itemId: string
  /** Numeric response value. */
  value: number
  /** Maximum possible value for this item. */
  maxValue: number
  /** Whether the item is reverse-scored. */
  reverseScored?: boolean
}

/** A full response matrix: participants × items. */
export interface ResponseMatrix {
  /** Map from item ID to array of responses (one per participant, ordered). */
  itemResponses: Map<string, number[]>
  /** Total scores per participant (same ordering as item arrays). */
  totalScores: number[]
  /** Maximum possible value per item. */
  itemMaxValues: Map<string, number>
  /** Number of participants. */
  n: number
}

// ---------------------------------------------------------------------------
// Response matrix builder
// ---------------------------------------------------------------------------

/**
 * Build a response matrix from flat response records.
 *
 * Groups responses by participant and item, computes total scores
 * (with reverse-scoring applied), and validates consistency.
 *
 * @param responses - Flat array of responses. Each participant should have
 *                    responses for the same set of items.
 * @returns Structured response matrix.
 */
export function buildResponseMatrix(
  responses: { participantId: string; itemId: string; value: number; maxValue: number; reverseScored?: boolean }[],
): ResponseMatrix {
  // Group by participant
  const byParticipantItem = new Map<string, Map<string, { value: number; maxValue: number; reverseScored?: boolean }>>()
  const allItemIds = new Set<string>()
  const itemMaxValues = new Map<string, number>()

  for (const r of responses) {
    allItemIds.add(r.itemId)
    itemMaxValues.set(r.itemId, r.maxValue)

    let participantMap = byParticipantItem.get(r.participantId)
    if (!participantMap) {
      participantMap = new Map()
      byParticipantItem.set(r.participantId, participantMap)
    }
    participantMap.set(r.itemId, { value: r.value, maxValue: r.maxValue, reverseScored: r.reverseScored })
  }

  const participantIds = [...byParticipantItem.keys()]
  const itemIds = [...allItemIds]
  const n = participantIds.length

  // Build item response arrays and total scores
  const itemResponses = new Map<string, number[]>()
  for (const itemId of itemIds) {
    itemResponses.set(itemId, [])
  }

  const totalScores: number[] = []

  for (const participantId of participantIds) {
    const participantMap = byParticipantItem.get(participantId)!
    let total = 0

    for (const itemId of itemIds) {
      const resp = participantMap.get(itemId)
      if (resp) {
        const effective = resp.reverseScored ? resp.maxValue - resp.value : resp.value
        itemResponses.get(itemId)!.push(effective)
        total += effective
      } else {
        // Missing response — use 0
        itemResponses.get(itemId)!.push(0)
      }
    }

    totalScores.push(total)
  }

  return { itemResponses, totalScores, itemMaxValues, n }
}

// ---------------------------------------------------------------------------
// Core statistics
// ---------------------------------------------------------------------------

/**
 * Compute CTT difficulty (p-value) for a single item.
 *
 * For Likert/polytomous items: mean score / max possible.
 * For dichotomous items: proportion correct.
 *
 * @param scores   - Array of observed scores for this item (one per participant).
 * @param maxValue - Maximum possible score for this item.
 * @returns Difficulty in [0, 1].
 */
export function itemDifficulty(scores: number[], maxValue: number): number {
  if (scores.length === 0 || maxValue === 0) return 0
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length
  return mean / maxValue
}

/**
 * Compute corrected item-total correlation (discrimination).
 *
 * "Corrected" means the item's own score is removed from the total
 * before computing the Pearson correlation. This avoids the part-whole
 * contamination that inflates uncorrected correlations.
 *
 * @param itemScores  - Array of scores for this item.
 * @param totalScores - Array of total scores across all items.
 * @returns Corrected item-total correlation in [-1, 1].
 */
export function correctedItemTotalCorrelation(
  itemScores: number[],
  totalScores: number[],
): number {
  const n = itemScores.length
  if (n < 3) return 0

  // Corrected totals: remove this item's contribution
  const correctedTotals = totalScores.map((t, i) => t - itemScores[i])

  return pearsonR(itemScores, correctedTotals)
}

/**
 * Compute Cronbach's alpha for a scale *without* a specific item.
 *
 * @param allItemScores - Map from item ID to score arrays.
 * @param excludeItemId - The item to exclude.
 * @returns Alpha-if-deleted value.
 */
export function alphaIfDeleted(
  allItemScores: Map<string, number[]>,
  excludeItemId: string,
): number {
  const entries = [...allItemScores.entries()].filter(([id]) => id !== excludeItemId)
  if (entries.length < 2) return 0

  const n = entries[0][1].length
  const k = entries.length

  // Item variances
  let sumItemVar = 0
  for (const [, scores] of entries) {
    sumItemVar += variance(scores)
  }

  // Total score variance (without the excluded item)
  const totals: number[] = new Array(n).fill(0)
  for (const [, scores] of entries) {
    for (let i = 0; i < n; i++) {
      totals[i] += scores[i]
    }
  }
  const totalVar = variance(totals)

  if (totalVar === 0) return 0
  return (k / (k - 1)) * (1 - sumItemVar / totalVar)
}

/**
 * Compute response distribution for an item.
 *
 * @param scores - Array of raw (un-reversed) response values.
 * @returns Map from option value to count.
 */
export function responseDistribution(scores: number[]): Record<number, number> {
  const dist: Record<number, number> = {}
  for (const v of scores) {
    dist[v] = (dist[v] ?? 0) + 1
  }
  return dist
}

// ---------------------------------------------------------------------------
// Distractor analysis
// ---------------------------------------------------------------------------

/**
 * Compute point-biserial correlation for each option value of an item.
 *
 * For each option k, the point-biserial is the Pearson correlation between
 * a binary indicator (1 if participant chose k, 0 otherwise) and the
 * corrected total score.
 *
 * For the keyed (correct) option, point-biserial should be positive.
 * For distractors, it should be negative or near zero. A positive
 * point-biserial on a distractor indicates the wrong option is
 * attracting high-ability participants — a serious item flaw.
 *
 * @param rawItemScores - Raw (un-reversed) scores for this item.
 * @param totalScores   - Total scores across all items.
 * @param optionLabels  - Map from option value to label.
 * @returns Array of distractor analyses.
 */
export function distractorAnalysis(
  rawItemScores: number[],
  totalScores: number[],
  optionLabels: Map<number, string>,
): DistractorAnalysis[] {
  const n = rawItemScores.length
  if (n < 3) return []

  // Corrected totals
  const correctedTotals = totalScores.map((t, i) => t - rawItemScores[i])

  // Get all unique option values
  const optionValues = [...new Set(rawItemScores)].sort((a, b) => a - b)

  return optionValues.map((optionValue) => {
    const binary = rawItemScores.map((v): number => (v === optionValue ? 1 : 0))
    const count = binary.reduce((s, v) => s + v, 0)
    const proportion = count / n
    const pointBiserial = pearsonR(binary, correctedTotals)

    return {
      optionValue,
      optionLabel: optionLabels.get(optionValue) ?? String(optionValue),
      count,
      proportion,
      pointBiserial,
    }
  })
}

// ---------------------------------------------------------------------------
// Full item analysis
// ---------------------------------------------------------------------------

/**
 * Compute all CTT statistics for every item in a response matrix.
 *
 * @param matrix - The response matrix.
 * @returns Array of item statistics, one per item.
 */
export function computeItemStatistics(matrix: ResponseMatrix): CTTItemStatistics[] {
  const results: CTTItemStatistics[] = []

  for (const [itemId, scores] of matrix.itemResponses) {
    const maxValue = matrix.itemMaxValues.get(itemId) ?? 1
    const difficulty = itemDifficulty(scores, maxValue)
    const discrimination = correctedItemTotalCorrelation(scores, matrix.totalScores)
    const deleted = alphaIfDeleted(matrix.itemResponses, itemId)
    const dist = responseDistribution(scores)

    // Flag logic
    const flagReasons: string[] = []
    if (difficulty < 0.20) flagReasons.push('Too difficult (p < 0.20)')
    if (difficulty > 0.80) flagReasons.push('Too easy (p > 0.80)')
    if (discrimination < 0.20) flagReasons.push('Low discrimination (r < 0.20)')

    // Check for underused options (< 5% of responses)
    const total = scores.length
    for (const [value, count] of Object.entries(dist)) {
      if (count / total < 0.05) {
        flagReasons.push(`Option ${value} attracted < 5% of responses`)
      }
    }

    results.push({
      itemId,
      difficulty,
      discrimination,
      alphaIfDeleted: deleted,
      responseCount: matrix.n,
      responseDistribution: dist,
      flagged: flagReasons.length > 0,
      flagReasons,
    })
  }

  return results
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mean(arr: number[]): number {
  if (arr.length === 0) return 0
  return arr.reduce((s, v) => s + v, 0) / arr.length
}

function variance(arr: number[]): number {
  const m = mean(arr)
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length
}

function pearsonR(x: number[], y: number[]): number {
  const n = x.length
  if (n !== y.length || n < 3) return 0

  const mx = mean(x)
  const my = mean(y)

  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sumXY += dx * dy
    sumX2 += dx * dx
    sumY2 += dy * dy
  }

  const denom = Math.sqrt(sumX2 * sumY2)
  return denom > 0 ? sumXY / denom : 0
}
