/**
 * difficulty-targeting.ts
 *
 * Estimates item difficulty from embedding distance to construct centroid
 * and generates prompt steering instructions to fill difficulty gaps.
 *
 * Difficulty estimate is a semantic proxy (0 = near centroid = easy,
 * 1 = peripheral = hard). Not a calibrated IRT parameter.
 */

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export function computeDifficultyEstimate(
  itemEmbedding: number[],
  constructCentroid: number[],
): number {
  const similarity = cosineSimilarity(itemEmbedding, constructCentroid)
  return Math.max(0, Math.min(1, 1 - similarity))
}

const EASY_THRESHOLD = 0.33
const HARD_THRESHOLD = 0.66

const TARGET_EASY_PCT = 0.20
const TARGET_HARD_PCT = 0.30

export type DifficultySkew = 'easy' | 'hard' | 'balanced'

export interface DifficultyDistribution {
  easy: number
  moderate: number
  hard: number
  skew: DifficultySkew
}

export function analyzeDifficultyDistribution(
  estimates: number[],
): DifficultyDistribution {
  if (estimates.length === 0) {
    return { easy: 0, moderate: 0, hard: 0, skew: 'balanced' }
  }

  let easy = 0, moderate = 0, hard = 0
  for (const est of estimates) {
    if (est < EASY_THRESHOLD) easy++
    else if (est >= HARD_THRESHOLD) hard++
    else moderate++
  }

  const total = estimates.length
  const easyPct = easy / total
  const hardPct = hard / total

  let skew: DifficultySkew = 'balanced'
  if (easyPct > TARGET_EASY_PCT + 0.15 && hardPct < TARGET_HARD_PCT - 0.10) {
    skew = 'easy'
  } else if (hardPct > TARGET_HARD_PCT + 0.15 && easyPct < TARGET_EASY_PCT - 0.05) {
    skew = 'hard'
  }

  return { easy, moderate, hard, skew }
}

export function buildDifficultySteering(skew: DifficultySkew): string {
  if (skew === 'easy') {
    return `\n## Difficulty Steering\nThe item pool is currently skewed toward easy-to-endorse items. For this batch, focus on items that only someone genuinely high on this construct would endorse. Use trade-off framing, friction situations, and conditional behaviours to create harder items.`
  }
  if (skew === 'hard') {
    return `\n## Difficulty Steering\nThe item pool is currently skewed toward hard-to-endorse items. For this batch, focus on broadly relatable behavioural expressions of the construct that most people with moderate standing would endorse.`
  }
  return ''
}
