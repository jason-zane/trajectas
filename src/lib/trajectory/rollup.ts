import type {
  TrajectoryDelta,
  TrajectoryMover,
  TrajectoryPoint,
  TrajectorySeries,
  TrajectorySummary,
} from './types'

/**
 * Compute pairwise deltas for a single entity's series. The points are
 * expected to be sorted ascending by completedAt. We emit one delta per
 * consecutive pair, then append a first-to-latest delta as the final
 * element when there are 3+ points (it duplicates the only consecutive
 * pair when there are exactly 2).
 */
export function computeDeltas(points: TrajectoryPoint[]): TrajectoryDelta[] {
  if (points.length < 2) return []

  const out: TrajectoryDelta[] = []
  for (let i = 1; i < points.length; i++) {
    out.push(buildDelta(points[i - 1], points[i]))
  }
  if (points.length >= 3) {
    out.push(buildDelta(points[0], points[points.length - 1]))
  }
  return out
}

function buildDelta(from: TrajectoryPoint, to: TrajectoryPoint): TrajectoryDelta {
  const a = from.scaledScore
  const b = to.scaledScore
  const deltaScaled = a !== null && b !== null ? b - a : null
  const deltaScaledFraction =
    deltaScaled !== null && a !== null && a !== 0 ? deltaScaled / Math.abs(a) : null
  const daysBetween = computeDaysBetween(from.completedAt, to.completedAt)

  return {
    fromSessionId: from.sessionId,
    toSessionId: to.sessionId,
    fromCompletedAt: from.completedAt,
    toCompletedAt: to.completedAt,
    daysBetween,
    deltaScaled,
    deltaScaledFraction,
  }
}

function computeDaysBetween(fromIso: string, toIso: string): number {
  const f = Date.parse(fromIso)
  const t = Date.parse(toIso)
  if (!Number.isFinite(f) || !Number.isFinite(t)) return 0
  return Math.round((t - f) / (1000 * 60 * 60 * 24))
}

/**
 * Bin the magnitude of a delta into a coarse class for UI colouring. NOT
 * a psychometric judgement — see the spec's out-of-scope: reliability /
 * RCI is the future work. This is just a heuristic to give users a sense
 * of "small / medium / large" change at a glance.
 *
 * Tuned for scaled_score values, which in Trajectas are typically rounded
 * 0..100 percentile-ish numbers.
 */
export type DeltaMagnitude = 'none' | 'small' | 'medium' | 'large'

export function deltaMagnitude(deltaScaled: number | null): DeltaMagnitude {
  if (deltaScaled === null) return 'none'
  const abs = Math.abs(deltaScaled)
  if (abs < 3) return 'none'
  if (abs < 8) return 'small'
  if (abs < 15) return 'medium'
  return 'large'
}

/**
 * Movement smaller than this on the scaled scale is treated as noise.
 * Used by both the editorial summary partition (topMovers vs stable) and the
 * "Within noise" rule in the movers list. Tuned to match the noise band
 * visualised behind the magnitude bars.
 */
export const STABLE_THRESHOLD = 5

function moverFromSeries(series: TrajectorySeries): TrajectoryMover | null {
  const points = series.points
  if (points.length === 0) return null
  const first = points[0]?.scaledScore ?? null
  const latest = points[points.length - 1]?.scaledScore ?? null
  const deltaScaled = first !== null && latest !== null ? latest - first : null
  return {
    entityId: series.entityId,
    entityName: series.entityName,
    firstScaled: first,
    latestScaled: latest,
    deltaScaled,
    pointCount: points.length,
  }
}

/**
 * Editorial summary derived from a fully-assembled dimension-level series
 * list. Counts the unique sessions (across all dimensions), date range,
 * and splits dimensions into movers vs. stable by absolute Δ. Series at
 * other levels are ignored.
 */
export function computeTrajectorySummary(
  series: TrajectorySeries[],
): TrajectorySummary {
  const dimensionSeries = series.filter((s) => s.level === 'dimension')

  const sessionIds = new Set<string>()
  const assessmentIds = new Set<string>()
  let earliest: string | null = null
  let latest: string | null = null

  for (const s of dimensionSeries) {
    for (const p of s.points) {
      sessionIds.add(p.sessionId)
      assessmentIds.add(p.assessmentId)
      if (!earliest || p.completedAt < earliest) earliest = p.completedAt
      if (!latest || p.completedAt > latest) latest = p.completedAt
    }
  }

  const movers: TrajectoryMover[] = []
  for (const s of dimensionSeries) {
    const m = moverFromSeries(s)
    if (m && m.pointCount >= 2) movers.push(m)
  }

  const topMovers = movers
    .filter((m) => m.deltaScaled !== null && Math.abs(m.deltaScaled) >= STABLE_THRESHOLD)
    .sort(
      (a, b) =>
        Math.abs(b.deltaScaled ?? 0) - Math.abs(a.deltaScaled ?? 0),
    )

  const stable = movers
    .filter(
      (m) =>
        m.deltaScaled !== null &&
        Math.abs(m.deltaScaled) < STABLE_THRESHOLD,
    )
    // Sort by |Δ| desc so the combined topMovers→stable list reads
    // continuously from biggest to smallest movement.
    .sort(
      (a, b) =>
        Math.abs(b.deltaScaled ?? 0) - Math.abs(a.deltaScaled ?? 0),
    )

  return {
    sessionCount: sessionIds.size,
    assessmentCount: assessmentIds.size,
    earliestCompletedAt: earliest,
    latestCompletedAt: latest,
    topMovers,
    stable,
  }
}

export function emptyTrajectorySummary(): TrajectorySummary {
  return {
    sessionCount: 0,
    assessmentCount: 0,
    earliestCompletedAt: null,
    latestCompletedAt: null,
    topMovers: [],
    stable: [],
  }
}
