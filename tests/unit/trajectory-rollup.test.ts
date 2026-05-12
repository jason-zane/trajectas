/**
 * Unit tests for trajectory rollup pure-function helpers.
 * Pure (no DB), so they run under `npm run test:unit`.
 */

import { describe, expect, it } from 'vitest'
import {
  computeDeltas,
  deltaMagnitude,
} from '@/lib/trajectory/rollup'
import type { TrajectoryPoint } from '@/lib/trajectory/types'

function point(
  overrides: Partial<TrajectoryPoint> & { sessionId: string; completedAt: string },
): TrajectoryPoint {
  return {
    campaignId: 'cam',
    campaignTitle: 'cam-t',
    assessmentId: 'a',
    assessmentName: 'A',
    attemptNumber: 1,
    rawScore: null,
    percentile: null,
    reliability: null,
    normGroupId: null,
    normGroupName: null,
    scaledScore: null,
    ...overrides,
  }
}

describe('computeDeltas', () => {
  it('returns empty array for 0 or 1 points', () => {
    expect(computeDeltas([])).toEqual([])
    expect(
      computeDeltas([point({ sessionId: 's1', completedAt: '2026-01-01T00:00:00Z' })]),
    ).toEqual([])
  })

  it('returns a single consecutive pair for 2 points', () => {
    const p1 = point({ sessionId: 's1', completedAt: '2026-01-01T00:00:00Z', scaledScore: 50 })
    const p2 = point({ sessionId: 's2', completedAt: '2026-02-01T00:00:00Z', scaledScore: 60 })
    const deltas = computeDeltas([p1, p2])
    expect(deltas).toHaveLength(1)
    expect(deltas[0].deltaScaled).toBe(10)
    expect(deltas[0].daysBetween).toBe(31)
    expect(deltas[0].fromSessionId).toBe('s1')
    expect(deltas[0].toSessionId).toBe('s2')
  })

  it('returns consecutive pairs + first-to-latest for 3+ points', () => {
    const p1 = point({ sessionId: 's1', completedAt: '2026-01-01T00:00:00Z', scaledScore: 50 })
    const p2 = point({ sessionId: 's2', completedAt: '2026-02-01T00:00:00Z', scaledScore: 55 })
    const p3 = point({ sessionId: 's3', completedAt: '2026-03-01T00:00:00Z', scaledScore: 65 })
    const deltas = computeDeltas([p1, p2, p3])
    expect(deltas).toHaveLength(3)
    // First two are consecutive
    expect(deltas[0].deltaScaled).toBe(5)
    expect(deltas[1].deltaScaled).toBe(10)
    // Last is first-to-latest
    expect(deltas[2].fromSessionId).toBe('s1')
    expect(deltas[2].toSessionId).toBe('s3')
    expect(deltas[2].deltaScaled).toBe(15)
  })

  it('handles null scaledScore by emitting a null delta', () => {
    const p1 = point({ sessionId: 's1', completedAt: '2026-01-01T00:00:00Z', scaledScore: 50 })
    const p2 = point({ sessionId: 's2', completedAt: '2026-02-01T00:00:00Z', scaledScore: null })
    const deltas = computeDeltas([p1, p2])
    expect(deltas[0].deltaScaled).toBeNull()
    expect(deltas[0].deltaScaledFraction).toBeNull()
  })

  it('handles divide-by-zero on fraction when the from-score is 0', () => {
    const p1 = point({ sessionId: 's1', completedAt: '2026-01-01T00:00:00Z', scaledScore: 0 })
    const p2 = point({ sessionId: 's2', completedAt: '2026-02-01T00:00:00Z', scaledScore: 10 })
    const deltas = computeDeltas([p1, p2])
    expect(deltas[0].deltaScaled).toBe(10)
    expect(deltas[0].deltaScaledFraction).toBeNull()
  })
})

describe('deltaMagnitude', () => {
  it('returns none for null', () => {
    expect(deltaMagnitude(null)).toBe('none')
  })

  it('bins by absolute magnitude', () => {
    expect(deltaMagnitude(0)).toBe('none')
    expect(deltaMagnitude(2.5)).toBe('none')
    expect(deltaMagnitude(-2.5)).toBe('none')
    expect(deltaMagnitude(5)).toBe('small')
    expect(deltaMagnitude(-7)).toBe('small')
    expect(deltaMagnitude(10)).toBe('medium')
    expect(deltaMagnitude(-14)).toBe('medium')
    expect(deltaMagnitude(20)).toBe('large')
    expect(deltaMagnitude(-50)).toBe('large')
  })
})
