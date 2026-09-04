import { describe, expect, it } from 'vitest'
import {
  NOISE_FLOOR,
  biggestChange,
  comparisonLede,
  formatSigned,
  isMeaningfulChange,
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
      campaignId: 'cam',
      campaignTitle: 'Campaign',
      attemptNumber: i + 1,
      value,
      ciLower: null,
      ciUpper: null,
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
      { personKey: 'amara', first: 48, latest: 75, delta: 27, significant: null },
      { personKey: 'ben', first: 68, latest: 67, delta: -1, significant: null },
    ])
  })

  it('gives null stats for a person with no series on the entity', () => {
    const stats = statsFor(SERIES, 'relating', ['amara', 'priya'])
    expect(stats[1]).toEqual({ personKey: 'priya', first: null, latest: null, delta: null, significant: null })
  })

  it('treats a single measured session as no measurable change', () => {
    const stats = statsFor(SERIES, 'thinking', ['amara'])
    expect(stats[0]).toEqual({ personKey: 'amara', first: 60, latest: 60, delta: null, significant: null })
  })
})

describe('significance from confidence bands', () => {
  function mkCiSeries(values: [number, number, number][]): CanvasSeries {
    return {
      personKey: 'p',
      entityId: 'e',
      points: values.map(([value, lo, hi], i) => ({
        sessionId: `s${i}`,
        completedAt: `2026-0${i + 1}-01T00:00:00Z`,
        assessmentId: 'a1',
        assessmentName: 'Assessment',
        campaignId: 'cam',
        campaignTitle: 'Campaign',
        attemptNumber: i + 1,
        value,
        ciLower: lo,
        ciUpper: hi,
      })),
    }
  }

  it('is true when first and latest bands do not overlap', () => {
    const stats = statsFor([mkCiSeries([[50, 45, 55], [70, 65, 75]])], 'e', ['p'])
    expect(stats[0].significant).toBe(true)
  })

  it('is false when the bands overlap', () => {
    const stats = statsFor([mkCiSeries([[50, 45, 55], [54, 49, 59]])], 'e', ['p'])
    expect(stats[0].significant).toBe(false)
  })

  it('is null when bands are missing, and consumers fall back to the noise floor', () => {
    const stats = statsFor(SERIES, 'relating', ['amara'])
    expect(stats[0].significant).toBeNull()
    expect(isMeaningfulChange(stats[0])).toBe(true)
    expect(isMeaningfulChange({ delta: 1, significant: null })).toBe(false)
    expect(isMeaningfulChange({ delta: 1, significant: true })).toBe(true)
    expect(isMeaningfulChange({ delta: 20, significant: false })).toBe(false)
    expect(isMeaningfulChange({ delta: null, significant: null })).toBe(false)
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
  // Unauthored: every displayOrder at the column default, so name decides.
  const entities: CanvasEntity[] = [
    { id: 'b', name: 'Bravo', level: 'dimension', parentId: null, displayOrder: 0 },
    { id: 'a', name: 'Alpha', level: 'dimension', parentId: null, displayOrder: 0 },
    { id: 'c', name: 'Charlie', level: 'dimension', parentId: null, displayOrder: 0 },
  ]
  const metric = (id: string) => ({ a: 5, b: 20, c: 11 })[id as 'a' | 'b' | 'c']

  it('standard order falls back to alphabetical when nothing is authored', () => {
    expect(orderEntities(entities, metric, 'standard').map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('standard order follows display_order once it is authored', () => {
    // The 5Brains case: framework order must beat the alphabet.
    const brains: CanvasEntity[] = [
      { id: 'blue', name: 'BlueBrain', level: 'dimension', parentId: null, displayOrder: 4 },
      { id: 'red', name: 'RedBrain', level: 'dimension', parentId: null, displayOrder: 1 },
      { id: 'green', name: 'GreenBrain', level: 'dimension', parentId: null, displayOrder: 3 },
      { id: 'pink', name: 'PinkBrain', level: 'dimension', parentId: null, displayOrder: 5 },
      { id: 'orange', name: 'OrangeBrain', level: 'dimension', parentId: null, displayOrder: 2 },
    ]
    expect(orderEntities(brains, () => 0, 'standard').map((e) => e.id)).toEqual([
      'red',
      'orange',
      'green',
      'blue',
      'pink',
    ])
  })

  it('change and difference orders sort by the metric, descending', () => {
    expect(orderEntities(entities, metric, 'change').map((e) => e.id)).toEqual(['b', 'c', 'a'])
    expect(orderEntities(entities, metric, 'difference').map((e) => e.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks a metric tie on framework order, not the alphabet', () => {
    const tied: CanvasEntity[] = [
      { id: 'pink', name: 'PinkBrain', level: 'dimension', parentId: null, displayOrder: 5 },
      { id: 'red', name: 'RedBrain', level: 'dimension', parentId: null, displayOrder: 1 },
    ]
    expect(orderEntities(tied, () => 7, 'change').map((e) => e.id)).toEqual(['red', 'pink'])
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
      { personKey: 'amara', first: 48, latest: 60, delta: 12, significant: null },
      { personKey: 'ben', first: 70, latest: 71, delta: 1, significant: null },
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
      { personKey: 'amara', first: 60, latest: 61, delta: 1, significant: null },
      { personKey: 'ben', first: 70, latest: 70, delta: 0, significant: null },
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
