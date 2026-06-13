import { describe, expect, it } from 'vitest'
import { buildCanvasCsv } from '@/lib/canvas/build-csv'
import { OVERALL_ID, type CanvasResult } from '@/lib/canvas/types'

function point(sessionId: string, date: string, value: number) {
  return {
    sessionId,
    completedAt: `${date}T10:00:00Z`,
    assessmentId: 'a1',
    assessmentName: 'Assessment',
    campaignId: 'cam',
    campaignTitle: 'Campaign',
    attemptNumber: 1,
    value,
    ciLower: null,
    ciUpper: null,
  }
}

const RESULT: CanvasResult = {
  people: [
    {
      personKey: 'amara',
      entryCpId: 'cp-a',
      displayName: 'Amara, "AO" Okafor',
      email: 'a@x.com',
      completedSessionCount: 2,
      firstCompletedAt: '2025-09-01T10:00:00Z',
      lastCompletedAt: '2026-05-01T10:00:00Z',
    },
    {
      personKey: 'ben',
      entryCpId: 'cp-b',
      displayName: 'Ben Castillo',
      email: 'b@x.com',
      completedSessionCount: 1,
      firstCompletedAt: '2026-05-02T10:00:00Z',
      lastCompletedAt: '2026-05-02T10:00:00Z',
    },
  ],
  entities: [
    { id: 'dim1', name: 'Relating', level: 'dimension', parentId: null },
    { id: 'f1', name: 'Influence', level: 'factor', parentId: 'dim1' },
  ],
  series: [
    { personKey: 'amara', entityId: OVERALL_ID, points: [point('s1', '2025-09-01', 50), point('s2', '2026-05-01', 62)] },
    { personKey: 'amara', entityId: 'dim1', points: [point('s1', '2025-09-01', 48), point('s2', '2026-05-01', 60)] },
    { personKey: 'amara', entityId: 'f1', points: [point('s2', '2026-05-01', 64)] },
    { personKey: 'ben', entityId: OVERALL_ID, points: [point('s3', '2026-05-02', 70)] },
    { personKey: 'ben', entityId: 'dim1', points: [point('s3', '2026-05-02', 71)] },
  ],
  clientId: 'client-1',
}

describe('buildCanvasCsv', () => {
  const csv = buildCanvasCsv(RESULT)
  const lines = csv.split('\n')

  it('escapes display names and emits per-person session-date columns', () => {
    const amara = '"Amara, ""AO"" Okafor'
    expect(lines[0]).toBe(
      [
        'Competency',
        'Level',
        `${amara} first"`,
        `${amara} latest"`,
        `${amara} change"`,
        `${amara} 2025-09-01"`,
        `${amara} 2026-05-01"`,
        'Ben Castillo first',
        'Ben Castillo latest',
        'Ben Castillo change',
        'Ben Castillo 2026-05-02',
      ].join(','),
    )
  })

  it('orders rows Overall → dimension → its factors', () => {
    expect(lines[1].startsWith('Overall,composite')).toBe(true)
    expect(lines[2].startsWith('Relating,dimension')).toBe(true)
    expect(lines[3].startsWith('Influence,factor')).toBe(true)
  })

  it('fills first/latest/change and per-session values, blank where unmeasured', () => {
    expect(lines[1]).toBe(
      'Overall,composite,50,62,12,50,62,70,70,,70',
    )
    expect(lines[3]).toBe(
      'Influence,factor,64,64,,,64,,,,',
    )
  })

  it('single-session people get no change value', () => {
    const benCells = lines[1].split(',').slice(7)
    expect(benCells[2]).toBe('')
  })

  it('neutralises spreadsheet formulas in user-controlled text, but not numbers', () => {
    const hostile: CanvasResult = {
      ...RESULT,
      people: [
        { ...RESULT.people[0], displayName: '=HYPERLINK("http://evil")' },
        RESULT.people[1],
      ],
    }
    const out = buildCanvasCsv(hostile)
    expect(out).toContain(`"'=HYPERLINK(""http://evil"") first"`)
    expect(out).not.toMatch(/(^|,)=HYPERLINK/m)
    // Negative deltas stay plain numbers.
    expect(buildCanvasCsv(RESULT)).not.toContain("'-")
  })
})
