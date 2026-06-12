import { describe, expect, it } from 'vitest'
import {
  NOISE_FLOOR,
  biggestChange,
  comparisonLede,
  formatSigned,
  maxAbsChange,
  monthYear,
  orderEntities,
  rangeSentence,
  soloLede,
  spread,
  statsFor,
} from '@/lib/canvas/summarize'
import type { CanvasEntity, CanvasSeries } from '@/lib/canvas/types'

function mkSeries(personKey: string, entityId: string, values: number[]): CanvasSeries {
  return {
    personKey,
    entityId,
    points: values.map((value, i) => ({
      sessionId: `s-${personKey}-${i}`,
      completedAt: `2026-0${i + 1}-01T00:00:00Z`,
      assessmentId: 'a1',
      assessmentName: 'Assessment',
      attemptNumber: i + 1,
      value,
    })),
  }
}

const SERIES: CanvasSeries[] = [
  mkSeries('amara', 'relating', [48, 57, 75]),
  mkSeries('ben', 'relating', [68, 67, 67]),
  mkSeries('amara', 'thinking', [60]),
]

describe('statsFor', () => {
  it('returns first/latest/delta per person in the requested order', () => {
    const stats = statsFor(SERIES, 'relating', ['amara', 'ben'])
    expect(stats).toEqual([
      { personKey: 'amara', first: 48, latest: 75, delta: 27 },
      { personKey: 'ben', first: 68, latest: 67, delta: -1 },
    ])
  })

  it('gives null stats for a person with no series on the entity', () => {
    const stats = statsFor(SERIES, 'relating', ['amara', 'priya'])
    expect(stats[1]).toEqual({ personKey: 'priya', first: null, latest: null, delta: null })
  })

  it('treats a single measured session as no measurable change', () => {
    const stats = statsFor(SERIES, 'thinking', ['amara'])
    expect(stats[0]).toEqual({ personKey: 'amara', first: 60, latest: 60, delta: null })
  })
})

describe('row metrics', () => {
  const stats = statsFor(SERIES, 'relating', ['amara', 'ben'])

  it('maxAbsChange picks the largest absolute movement', () => {
    expect(maxAbsChange(stats)).toBe(27)
  })

  it('spread is the gap between highest and lowest current score', () => {
    expect(spread(stats)).toBe(8)
  })

  it('spread is 0 with fewer than two scored people', () => {
    expect(spread(statsFor(SERIES, 'thinking', ['amara']))).toBe(0)
  })
})

describe('orderEntities', () => {
  const entities: CanvasEntity[] = [
    { id: 'b', name: 'Bravo', level: 'dimension', parentId: null },
    { id: 'a', name: 'Alpha', level: 'dimension', parentId: null },
    { id: 'c', name: 'Charlie', level: 'dimension', parentId: null },
  ]
  const metric = (id: string) => ({ a: 5, b: 20, c: 11 })[id as 'a' | 'b' | 'c']

  it('standard order is alphabetical', () => {
    expect(orderEntities(entities, metric, 'standard').map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('change and difference orders sort by the metric, descending', () => {
    expect(orderEntities(entities, metric, 'change').map((e) => e.id)).toEqual(['b', 'c', 'a'])
    expect(orderEntities(entities, metric, 'difference').map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('does not mutate the input array', () => {
    const before = entities.map((e) => e.id)
    orderEntities(entities, metric, 'change')
    expect(entities.map((e) => e.id)).toEqual(before)
  })
})

describe('sentences', () => {
  const names = new Map([
    ['amara', 'Amara Okafor'],
    ['ben', 'Ben Castillo'],
  ])

  it('biggestChange picks the largest absolute delta', () => {
    const stats = statsFor(SERIES, 'relating', ['amara', 'ben'])
    expect(biggestChange(stats)).toEqual({ personKey: 'amara', delta: 27 })
  })

  it('rangeSentence covers the now-scores', () => {
    const stats = statsFor(SERIES, 'relating', ['amara', 'ben'])
    expect(rangeSentence(stats)).toBe('Everyone sits between 67 and 75')
  })

  it('rangeSentence is null for a single person', () => {
    expect(rangeSentence(statsFor(SERIES, 'relating', ['amara']))).toBeNull()
  })

  it('comparisonLede omits the leader sentence when the riser already leads', () => {
    const stats = statsFor(SERIES, 'relating', ['amara', 'ben'])
    const lede = comparisonLede({
      entityName: 'Relating',
      stats,
      nameByPerson: names,
      sinceLabel: 'Jan 2026',
    })
    expect(lede).toBe('Amara Okafor has risen the most on Relating (+27 since Jan 2026).')
  })

  it('comparisonLede names the leader when they differ from the riser', () => {
    const stats = [
      { personKey: 'amara', first: 48, latest: 60, delta: 12 },
      { personKey: 'ben', first: 70, latest: 71, delta: 1 },
    ]
    const lede = comparisonLede({
      entityName: 'Relating',
      stats,
      nameByPerson: names,
      sinceLabel: null,
    })
    expect(lede).toBe(
      'Amara Okafor has risen the most on Relating (+12). Ben Castillo is highest today.',
    )
  })

  it('comparisonLede degrades to a flat message when movement is inside the noise floor', () => {
    const flat = [
      { personKey: 'amara', first: 60, latest: 61, delta: 1 },
      { personKey: 'ben', first: 70, latest: 70, delta: 0 },
    ]
    const lede = comparisonLede({
      entityName: 'Relating',
      stats: flat,
      nameByPerson: names,
      sinceLabel: null,
    })
    expect(lede).toBe('Little movement on Relating so far. Ben Castillo is highest today at 70.')
  })

  it('soloLede reports the biggest child shift', () => {
    const lede = soloLede({
      childStats: [
        { name: 'Influence', delta: 18 },
        { name: 'Empathy', delta: -4 },
      ],
      sessionCount: 4,
      sinceLabel: 'Sep 2025',
    })
    expect(lede).toBe('4 assessments since Sep 2025. Biggest shift: Influence (+18).')
  })

  it('soloLede explains a single-session baseline', () => {
    const lede = soloLede({ childStats: [], sessionCount: 1, sinceLabel: 'Sep 2025' })
    expect(lede).toBe(
      '1 assessment since Sep 2025. A baseline — movement appears after the next assessment.',
    )
  })

  it('soloLede reports steadiness below the noise floor', () => {
    const lede = soloLede({
      childStats: [{ name: 'Influence', delta: NOISE_FLOOR - 1 }],
      sessionCount: 3,
      sinceLabel: null,
    })
    expect(lede).toBe('3 assessments. Scores have held steady.')
  })
})

describe('formatting', () => {
  it('formatSigned prefixes positives', () => {
    expect(formatSigned(12)).toBe('+12')
    expect(formatSigned(-3)).toBe('-3')
    expect(formatSigned(0)).toBe('0')
  })

  it('monthYear formats ISO dates and rejects junk', () => {
    expect(monthYear('2025-09-14T10:00:00Z')).toMatch(/Sep/)
    expect(monthYear('not-a-date')).toBeNull()
    expect(monthYear(null)).toBeNull()
  })
})
