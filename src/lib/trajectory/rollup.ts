import type { TrajectoryDelta, TrajectoryPoint } from './types'

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
