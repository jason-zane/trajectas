import { describe, it, expect } from 'vitest'
import { byDisplayOrder } from '@/lib/taxonomy-order'

/**
 * The 5Brains framework order, as authored in dimensions.display_order by
 * 20260904120000_five_brains_display_order.sql and rendered by the hand-coded
 * report's BRAIN_ORDER constant. Every results surface has to agree with it.
 */
const BRAINS = [
  { name: 'RedBrain', displayOrder: 1 },
  { name: 'OrangeBrain', displayOrder: 2 },
  { name: 'GreenBrain', displayOrder: 3 },
  { name: 'BlueBrain', displayOrder: 4 },
  { name: 'PinkBrain', displayOrder: 5 },
]

const names = (list: Array<{ name: string }>) => list.map((d) => d.name)

describe('byDisplayOrder', () => {
  it('puts the five brains in framework order regardless of input order', () => {
    const shuffled = [BRAINS[3], BRAINS[0], BRAINS[4], BRAINS[2], BRAINS[1]]
    expect(names([...shuffled].sort(byDisplayOrder))).toEqual([
      'RedBrain',
      'OrangeBrain',
      'GreenBrain',
      'BlueBrain',
      'PinkBrain',
    ])
  })

  it('does not fall back to alphabetical once display_order is authored', () => {
    // Alphabetical would give Blue, Green, Orange, Pink, Red — the old
    // builder-report order, and the bug this comparator exists to close.
    expect(names([...BRAINS].sort(byDisplayOrder))[0]).toBe('RedBrain')
  })

  it('does not rank by score — framework order outranks a high result', () => {
    // The session panel and consultant email used to sort highest-first.
    const withScores = [
      { name: 'PinkBrain', displayOrder: 5, score: 92 },
      { name: 'RedBrain', displayOrder: 1, score: 41 },
    ]
    expect(names([...withScores].sort(byDisplayOrder))).toEqual(['RedBrain', 'PinkBrain'])
  })

  it('falls back to name when display_order ties, so ties are stable', () => {
    const unauthored = [
      { name: 'PinkBrain', displayOrder: 0 },
      { name: 'BlueBrain', displayOrder: 0 },
      { name: 'RedBrain', displayOrder: 0 },
    ]
    expect(names([...unauthored].sort(byDisplayOrder))).toEqual([
      'BlueBrain',
      'PinkBrain',
      'RedBrain',
    ])
  })

  it('treats a missing or null display_order as the column default of 0', () => {
    const mixed = [
      { name: 'Authored', displayOrder: 1 },
      { name: 'Absent' },
      { name: 'Null', displayOrder: null },
    ]
    // Both unauthored rows sort ahead of display_order 1, alphabetically.
    expect(names([...mixed].sort(byDisplayOrder))).toEqual(['Absent', 'Null', 'Authored'])
  })

  it('tolerates a missing name', () => {
    const nameless = [{ displayOrder: 2 }, { name: 'Second', displayOrder: 3 }]
    expect([...nameless].sort(byDisplayOrder)[0]).toEqual({ displayOrder: 2 })
  })
})
