/**
 * Calibration data preparation (pure, testable).
 *
 * Prepares raw response data for psychometric calibration by grouping by
 * construct, filtering to complete cases, and building matrices suitable for
 * item statistics and reliability computation.
 *
 * Key assumptions:
 *
 * - **Grouping by construct**: Item statistics and alpha are only meaningful
 *   within a single scale. This module groups responses by construct_id and
 *   prepares each construct independently.
 * - **Complete cases only**: For each construct, only sessions that answered
 *   EVERY item in that construct's set are included. Incomplete sessions are
 *   dropped and counted.
 * - **Sample size honesty**: Constructs with fewer than MIN_COMPUTABLE_N
 *   complete sessions are skipped entirely. Those with fewer than
 *   MIN_STABLE_N are flagged as unstable.
 * - **Reverse scoring**: Applied consistently to match buildResponseMatrix.
 *
 * @module
 */

/** Minimum sample size for stable CTT estimates. Below this, flag as unstable. */
export const MIN_STABLE_N = 100

/** Minimum sample size to attempt computation. Below this, skip the construct. */
export const MIN_COMPUTABLE_N = 5

/**
 * A single raw response for calibration preparation.
 */
export interface CalibrationResponseRow {
  /** Session/participant ID. */
  sessionId: string
  /** Item ID. */
  itemId: string
  /** Construct ID (groups the item into a scale). */
  constructId: string
  /** Numeric response value. */
  value: number
  /** Maximum possible value for this item. */
  maxValue: number
  /** Whether the item is reverse-scored. */
  reverseScored: boolean
}

/**
 * A prepared construct calibration dataset.
 *
 * Encapsulates all responses, metadata, and readiness checks for a single
 * construct. If skipped or unstable, callers must decide whether to proceed.
 */
export interface ConstructCalibrationSet {
  /** Construct ID. */
  constructId: string
  /** Distinct item IDs (sorted lexicographically for determinism). */
  itemIds: string[]
  /**
   * Rows for complete sessions only, reshaped for buildResponseMatrix.
   * Order matches personByItem rows.
   */
  responses: Array<{
    participantId: string
    itemId: string
    value: number
    maxValue: number
    reverseScored: boolean
  }>
  /**
   * Person-by-item matrix for calculateReliability input.
   * Rows = sessions (sorted by sessionId), columns = itemIds (in order).
   * Values are effective (reverse-scored applied).
   * Empty if skipped.
   */
  personByItem: number[][]
  /** Number of complete sessions included. */
  completeSessions: number
  /** Number of sessions dropped due to missing items. */
  droppedIncompleteSessions: number
  /** True if skipped (< MIN_COMPUTABLE_N or < 2 items). */
  skipped: boolean
  /** If skipped, the reason. */
  skipReason?: string
  /** True if < MIN_STABLE_N (and not skipped). */
  unstable: boolean
}

/**
 * Prepare construct-level calibration sets from raw response data.
 *
 * Groups responses by construct, filters to complete cases, builds matrices,
 * and computes metadata. Never throws; returns empty array on empty input.
 *
 * @param rows - Flat array of response rows (may contain duplicates, which
 *               are handled by keeping the last occurrence per (session, item)).
 * @returns Array of prepared construct sets, one per construct in the input.
 */
export function prepareConstructCalibration(
  rows: CalibrationResponseRow[],
): ConstructCalibrationSet[] {
  // Handle empty input
  if (rows.length === 0) {
    return []
  }

  // Group by construct
  const byConstruct = new Map<string, CalibrationResponseRow[]>()
  for (const row of rows) {
    const existing = byConstruct.get(row.constructId) ?? []
    existing.push(row)
    byConstruct.set(row.constructId, existing)
  }

  // Process each construct
  const results: ConstructCalibrationSet[] = []
  const constructIds = [...byConstruct.keys()].sort()

  for (const constructId of constructIds) {
    const constructRows = byConstruct.get(constructId)!
    const set = prepareOneConstruct(constructId, constructRows)
    results.push(set)
  }

  return results
}

/**
 * Prepare a single construct's calibration set.
 *
 * @internal
 */
function prepareOneConstruct(
  constructId: string,
  rows: CalibrationResponseRow[],
): ConstructCalibrationSet {
  // Deduplicate by (sessionId, itemId), keeping the last occurrence
  const dedup = new Map<string, CalibrationResponseRow>()
  for (const row of rows) {
    const key = `${row.sessionId}|${row.itemId}`
    dedup.set(key, row)
  }
  const dedupedRows = [...dedup.values()]

  // Distinct items and sessions
  const itemSet = new Set(dedupedRows.map((r) => r.itemId))
  const sessionSet = new Set(dedupedRows.map((r) => r.sessionId))

  const sessionIds = [...sessionSet].sort()

  // Partition sessions by the item set they were actually administered.
  //
  // Two assessments can administer different subsets of the same construct. A
  // single "must have answered every item in the construct" rule then drops
  // everyone who took the shorter form — silently shrinking n, or emptying the
  // sample entirely when no session saw every item. Instead, group sessions by
  // their exact administered set and calibrate the LARGEST coherent form; the
  // others are reported as dropped rather than mixed in.
  const setSignature = new Map<string, string[]>()
  const sessionsBySignature = new Map<string, string[]>()
  for (const sessionId of sessionIds) {
    const seen = dedupedRows
      .filter((r) => r.sessionId === sessionId)
      .map((r) => r.itemId)
      .sort()
    const signature = seen.join('|')
    setSignature.set(signature, seen)
    const bucket = sessionsBySignature.get(signature) ?? []
    bucket.push(sessionId)
    sessionsBySignature.set(signature, bucket)
  }

  let dominantSignature = ''
  let dominantCount = -1
  for (const [signature, sessions] of sessionsBySignature) {
    const itemCount = (setSignature.get(signature) ?? []).length
    // Prefer more sessions; break ties toward the longer form.
    if (
      sessions.length > dominantCount ||
      (sessions.length === dominantCount &&
        itemCount > (setSignature.get(dominantSignature) ?? []).length)
    ) {
      dominantCount = sessions.length
      dominantSignature = signature
    }
  }

  const itemIds = [...(setSignature.get(dominantSignature) ?? [...itemSet])].sort()

  // Skip if < 2 items or < 2 responses
  if (itemIds.length < 2) {
    return {
      constructId,
      itemIds,
      responses: [],
      personByItem: [],
      completeSessions: 0,
      droppedIncompleteSessions: sessionIds.length,
      skipped: true,
      skipReason: 'Fewer than 2 items in construct',
      unstable: false,
    }
  }

  // Index rows by (sessionId, itemId)
  const responseIndex = new Map<string, CalibrationResponseRow>()
  for (const row of dedupedRows) {
    responseIndex.set(`${row.sessionId}|${row.itemId}`, row)
  }

  // Filter to complete sessions (those with all items)
  const completeSessions = new Set<string>()
  for (const sessionId of sessionIds) {
    let isComplete = true
    for (const itemId of itemIds) {
      if (!responseIndex.has(`${sessionId}|${itemId}`)) {
        isComplete = false
        break
      }
    }
    if (isComplete) {
      completeSessions.add(sessionId)
    }
  }

  const droppedCount = sessionIds.length - completeSessions.size

  // Skip if too few complete sessions
  if (completeSessions.size < MIN_COMPUTABLE_N) {
    return {
      constructId,
      itemIds,
      responses: [],
      personByItem: [],
      completeSessions: completeSessions.size,
      droppedIncompleteSessions: droppedCount,
      skipped: true,
      skipReason: `Only ${completeSessions.size} complete session(s); minimum is ${MIN_COMPUTABLE_N}`,
      unstable: false,
    }
  }

  // Build response rows and person-by-item matrix
  const responses: ConstructCalibrationSet['responses'] = []
  const completeSessionIds = [...completeSessions].sort()
  const personByItem: number[][] = []

  for (const sessionId of completeSessionIds) {
    const row: number[] = []

    for (const itemId of itemIds) {
      const resp = responseIndex.get(`${sessionId}|${itemId}`)!

      // Apply reverse scoring: matches buildResponseMatrix line 101
      const effective = resp.reverseScored ? resp.maxValue - resp.value : resp.value
      row.push(effective)

      // Collect response for buildResponseMatrix consumption
      responses.push({
        participantId: sessionId,
        itemId,
        value: resp.value,
        maxValue: resp.maxValue,
        reverseScored: resp.reverseScored,
      })
    }

    personByItem.push(row)
  }

  return {
    constructId,
    itemIds,
    responses,
    personByItem,
    completeSessions: completeSessions.size,
    droppedIncompleteSessions: droppedCount,
    skipped: false,
    unstable: completeSessions.size < MIN_STABLE_N,
  }
}
