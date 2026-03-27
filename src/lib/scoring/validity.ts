/**
 * Validity scoring module — detects dishonest, careless, or inattentive responding.
 *
 * Validity items are excluded from construct scoring. Instead, they produce a
 * ValidityProfile that flags sessions for review or invalidation.
 *
 * @module
 */

import type { ItemPurpose } from '@/types/database'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ValidityFlag = 'valid' | 'review' | 'invalid'

export interface ValidityScale {
  /** Human-readable name for this scale. */
  scaleName: string
  /** Item purpose this scale evaluates. */
  purpose: ItemPurpose
  /** Total number of items in this scale. */
  itemCount: number
  /** Number of items that triggered a flag. */
  flaggedCount: number
  /** Score from 0-100 (higher = more concerning). */
  score: number
  /** Overall flag for this scale. */
  flag: ValidityFlag
  /** Human-readable explanation. */
  details: string
}

export interface ValidityProfile {
  /** Candidate session ID. */
  sessionId: string
  /** Individual validity scales. */
  scales: ValidityScale[]
  /** Worst flag across all scales. */
  overallFlag: ValidityFlag
  /** Response time analysis (if response_time_ms data available). */
  responseTimeFlags?: {
    /** Items answered in < 2 seconds. */
    suspiciouslyFast: number
    /** Total items in the session. */
    totalItems: number
  }
}

/** Metadata for a validity item used during scoring. */
export interface ValidityItemMeta {
  id: string
  purpose: ItemPurpose
  /** For attention checks: the correct response value. */
  keyedAnswer?: number
  /** Max value on the response scale (e.g. 5 for a 5-point Likert). */
  maxValue: number
  /** Min value on the response scale. */
  minValue: number
}

/** A single response to score for validity. */
export interface ValidityResponse {
  itemId: string
  responseValue: number
  responseTimeMs?: number
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score impression management items.
 *
 * Counts extreme endorsements (top anchor on the scale). People who
 * consistently select the most socially desirable response are likely
 * presenting an overly positive self-image.
 */
function scoreImpressionManagement(
  responses: ValidityResponse[],
  items: Map<string, ValidityItemMeta>,
): ValidityScale {
  let extremeCount = 0
  let totalCount = 0

  for (const r of responses) {
    const meta = items.get(r.itemId)
    if (!meta || meta.purpose !== 'impression_management') continue
    totalCount++
    // Extreme = top 2 anchors (e.g. 4-5 on 5-point, 6-7 on 7-point)
    const threshold = meta.maxValue - 1
    if (r.responseValue >= threshold) {
      extremeCount++
    }
  }

  if (totalCount === 0) {
    return {
      scaleName: 'Impression Management',
      purpose: 'impression_management',
      itemCount: 0,
      flaggedCount: 0,
      score: 0,
      flag: 'valid',
      details: 'No impression management items administered.',
    }
  }

  const rate = extremeCount / totalCount
  const score = Math.round(rate * 100)
  let flag: ValidityFlag = 'valid'
  let details = `${extremeCount} of ${totalCount} items endorsed at extreme level (${score}%).`

  if (rate > 0.8) {
    flag = 'invalid'
    details += ' Response pattern suggests significant impression management.'
  } else if (rate > 0.6) {
    flag = 'review'
    details += ' Elevated social desirability — interpret with caution.'
  }

  return {
    scaleName: 'Impression Management',
    purpose: 'impression_management',
    itemCount: totalCount,
    flaggedCount: extremeCount,
    score,
    flag,
    details,
  }
}

/**
 * Score infrequency items.
 *
 * Infrequency items are "bogus" statements almost no one would endorse.
 * Endorsing them suggests random or careless responding.
 */
function scoreInfrequency(
  responses: ValidityResponse[],
  items: Map<string, ValidityItemMeta>,
): ValidityScale {
  let endorsedCount = 0
  let totalCount = 0

  for (const r of responses) {
    const meta = items.get(r.itemId)
    if (!meta || meta.purpose !== 'infrequency') continue
    totalCount++
    // "Endorsed" = response above the midpoint of the scale
    const midpoint = (meta.maxValue + meta.minValue) / 2
    if (r.responseValue > midpoint) {
      endorsedCount++
    }
  }

  if (totalCount === 0) {
    return {
      scaleName: 'Infrequency',
      purpose: 'infrequency',
      itemCount: 0,
      flaggedCount: 0,
      score: 0,
      flag: 'valid',
      details: 'No infrequency items administered.',
    }
  }

  const score = Math.round((endorsedCount / totalCount) * 100)
  let flag: ValidityFlag = 'valid'
  let details = `${endorsedCount} of ${totalCount} infrequency items endorsed.`

  if (endorsedCount >= 2) {
    flag = 'invalid'
    details += ' Multiple bogus items endorsed — likely random responding.'
  } else if (endorsedCount >= 1) {
    flag = 'review'
    details += ' One bogus item endorsed — possible careless responding.'
  }

  return {
    scaleName: 'Infrequency',
    purpose: 'infrequency',
    itemCount: totalCount,
    flaggedCount: endorsedCount,
    score,
    flag,
    details,
  }
}

/**
 * Score attention check items.
 *
 * Attention checks have a known correct answer (keyed_answer). Failing
 * them indicates the respondent is not reading carefully.
 */
function scoreAttentionChecks(
  responses: ValidityResponse[],
  items: Map<string, ValidityItemMeta>,
): ValidityScale {
  let failedCount = 0
  let totalCount = 0

  for (const r of responses) {
    const meta = items.get(r.itemId)
    if (!meta || meta.purpose !== 'attention_check' || meta.keyedAnswer == null) continue
    totalCount++
    if (r.responseValue !== meta.keyedAnswer) {
      failedCount++
    }
  }

  if (totalCount === 0) {
    return {
      scaleName: 'Attention Checks',
      purpose: 'attention_check',
      itemCount: 0,
      flaggedCount: 0,
      score: 0,
      flag: 'valid',
      details: 'No attention check items administered.',
    }
  }

  const score = Math.round((failedCount / totalCount) * 100)
  let flag: ValidityFlag = 'valid'
  let details = `${failedCount} of ${totalCount} attention checks failed.`

  if (failedCount >= 2) {
    flag = 'invalid'
    details += ' Multiple attention checks failed — respondent likely not reading.'
  } else if (failedCount >= 1) {
    flag = 'review'
    details += ' One attention check failed — possible inattention.'
  }

  return {
    scaleName: 'Attention Checks',
    purpose: 'attention_check',
    itemCount: totalCount,
    flaggedCount: failedCount,
    score,
    flag,
    details,
  }
}

/**
 * Analyse response times for suspiciously fast responding.
 */
function analyseResponseTimes(
  responses: ValidityResponse[],
): ValidityProfile['responseTimeFlags'] | undefined {
  const withTimes = responses.filter((r) => r.responseTimeMs != null)
  if (withTimes.length === 0) return undefined

  const fast = withTimes.filter((r) => r.responseTimeMs! < 2000)

  return {
    suspiciouslyFast: fast.length,
    totalItems: withTimes.length,
  }
}

/**
 * Determine the worst flag from a set of flags.
 */
function worstFlag(flags: ValidityFlag[]): ValidityFlag {
  if (flags.includes('invalid')) return 'invalid'
  if (flags.includes('review')) return 'review'
  return 'valid'
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run the complete validity analysis for a candidate session.
 *
 * @param sessionId - The candidate session being analysed.
 * @param responses - All responses including validity items.
 * @param items     - Metadata for validity items (keyed by item ID).
 * @returns A ValidityProfile with scale-level and overall flags.
 */
export function runValidityAnalysis(
  sessionId: string,
  responses: ValidityResponse[],
  items: Map<string, ValidityItemMeta>,
): ValidityProfile {
  const scales: ValidityScale[] = [
    scoreImpressionManagement(responses, items),
    scoreInfrequency(responses, items),
    scoreAttentionChecks(responses, items),
  ]

  // Only include scales that had items administered
  const activeScales = scales.filter((s) => s.itemCount > 0)
  const allFlags = activeScales.map((s) => s.flag)

  // Response time analysis
  const responseTimeFlags = analyseResponseTimes(responses)
  if (responseTimeFlags) {
    const fastRate = responseTimeFlags.suspiciouslyFast / responseTimeFlags.totalItems
    if (fastRate > 0.5) {
      allFlags.push('invalid')
    } else if (fastRate > 0.25) {
      allFlags.push('review')
    }
  }

  return {
    sessionId,
    scales: activeScales,
    overallFlag: worstFlag(allFlags),
    responseTimeFlags,
  }
}
