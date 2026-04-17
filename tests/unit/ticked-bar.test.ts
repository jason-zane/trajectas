import { describe, it, expect } from 'vitest'
import { computeTickPositions } from '@/components/reports/charts/ticked-bar'
import type { BandDefinition } from '@/lib/reports/band-scheme'

const THREE_BANDS: BandDefinition[] = [
  { key: 'developing', label: 'Developing', min: 0, max: 40, indicatorTier: 'low' },
  { key: 'effective', label: 'Effective', min: 41, max: 69, indicatorTier: 'mid' },
  { key: 'highly_effective', label: 'Highly Effective', min: 70, max: 100, indicatorTier: 'high' },
]

const FIVE_BANDS: BandDefinition[] = [
  { key: 'emerging', label: 'Emerging', min: 0, max: 20, indicatorTier: 'low' },
  { key: 'developing', label: 'Developing', min: 21, max: 40, indicatorTier: 'low' },
  { key: 'competent', label: 'Competent', min: 41, max: 60, indicatorTier: 'mid' },
  { key: 'effective', label: 'Effective', min: 61, max: 80, indicatorTier: 'high' },
  { key: 'highly_effective', label: 'Highly Effective', min: 81, max: 100, indicatorTier: 'high' },
]

describe('computeTickPositions', () => {
  it('returns N-1 ticks for N bands (3-band)', () => {
    const ticks = computeTickPositions(THREE_BANDS)
    expect(ticks).toEqual([40, 69])
  })

  it('returns N-1 ticks for N bands (5-band)', () => {
    const ticks = computeTickPositions(FIVE_BANDS)
    expect(ticks).toEqual([20, 40, 60, 80])
  })

  it('returns empty array for single band', () => {
    const single: BandDefinition[] = [
      { key: 'all', label: 'All', min: 0, max: 100, indicatorTier: 'mid' },
    ]
    expect(computeTickPositions(single)).toEqual([])
  })

  it('returns empty array for empty bands', () => {
    expect(computeTickPositions([])).toEqual([])
  })
})
