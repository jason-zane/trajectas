import { describe, it, expect } from 'vitest'
import { buildComparisonCsv } from '@/lib/comparison/build-csv'
import type { ColumnGroup, ComparisonRow } from '@/lib/comparison/types'

const groups: ColumnGroup[] = [
  {
    assessmentId: 'a1',
    assessmentName: 'Leadership',
    rollup: { id: 'd1', name: 'Influence', level: 'dimension', parentId: null },
    children: [
      { id: 'f1', name: 'Persuasion', level: 'factor', parentId: 'd1' },
      { id: 'f2', name: 'Empathy, real', level: 'factor', parentId: 'd1' },
    ],
  },
]

const rows: ComparisonRow[] = [
  {
    entryId: 'e1',
    campaignParticipantId: 'cp1',
    participantName: "O'Connor, Sam",
    participantEmail: 'sam@example.com',
    perAssessment: [
      {
        assessmentId: 'a1',
        sessionId: 's1',
        sessionStartedAt: '2026-04-02T10:00:00Z',
        sessionStatus: 'completed',
        attemptNumber: 2,
        cells: { d1: 75, f1: 72, f2: 78 },
      },
    ],
  },
]

describe('buildComparisonCsv', () => {
  it('emits a header row with identity + group columns', () => {
    const csv = buildComparisonCsv({ columns: groups, rows })
    const [header] = csv.split('\n')
    expect(header).toBe(
      [
        'Participant',
        'Email',
        'Date',
        'Attempt #',
        'Assessment',
        'Session Status',
        'Influence',
        'Persuasion',
        '"Empathy, real"',
      ].join(','),
    )
  })

  it('emits one data row per (participant, assessment) and quotes commas/quotes', () => {
    const csv = buildComparisonCsv({ columns: groups, rows })
    const [, data] = csv.split('\n')
    expect(data).toBe(
      [
        '"O\'Connor, Sam"',
        'sam@example.com',
        '2026-04-02',
        '2',
        'Leadership',
        'completed',
        '75',
        '72',
        '78',
      ].join(','),
    )
  })

  it('renders blank cells (null) as empty strings', () => {
    const blanked: ComparisonRow[] = [
      {
        ...rows[0],
        perAssessment: [
          {
            ...rows[0].perAssessment[0],
            cells: { d1: null, f1: 72, f2: null },
          },
        ],
      },
    ]
    const csv = buildComparisonCsv({ columns: groups, rows: blanked })
    const [, data] = csv.split('\n')
    expect(data.endsWith(',,72,')).toBe(true)
  })

  it('escapes embedded double quotes by doubling them', () => {
    const csv = buildComparisonCsv({
      columns: groups,
      rows: [
        {
          ...rows[0],
          participantName: 'Say "Hi"',
          perAssessment: rows[0].perAssessment,
        },
      ],
    })
    const [, data] = csv.split('\n')
    expect(data.startsWith('"Say ""Hi"""')).toBe(true)
  })

  it('escapes newlines inside fields', () => {
    const csv = buildComparisonCsv({
      columns: groups,
      rows: [
        {
          ...rows[0],
          participantName: 'Line1\nLine2',
          perAssessment: rows[0].perAssessment,
        },
      ],
    })
    const dataRows = csv.split('\n').slice(1).join('\n')
    expect(dataRows.startsWith('"Line1\nLine2"')).toBe(true)
  })
})
