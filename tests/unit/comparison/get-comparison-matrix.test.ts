import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requireParticipantAccess = vi.fn()
const requireSessionAccess = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/auth/authorization', () => ({
  requireParticipantAccess: (id: string) => requireParticipantAccess(id),
  requireSessionAccess: (id: string) => requireSessionAccess(id),
  AuthorizationError: class AuthorizationError extends Error {},
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: fromMock }),
}))

import { getComparisonMatrix } from '@/app/actions/comparison'

/**
 * Build a thenable chain that supports the calls our action makes against the
 * mocked Supabase client. Each terminal operation (.in / .eq / order) returns
 * the resolved data.
 */
function makeChain(rows: unknown) {
  const result = { data: rows, error: null }
  const chain: Record<string, unknown> = {
    select: vi.fn(() => chain),
    in: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  }
  // Make the chain itself awaitable so that `await query.in(...)` works.
  ;(chain as { then?: unknown }).then = (
    onFulfilled?: (v: unknown) => unknown,
    onRejected?: (v: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected)
  return chain
}

function fromRouter(byTable: Record<string, unknown>) {
  return (table: string) => {
    if (!(table in byTable)) {
      throw new Error(`Unexpected table: ${table}`)
    }
    return makeChain(byTable[table])
  }
}

describe('getComparisonMatrix', () => {
  beforeEach(() => {
    requireParticipantAccess.mockReset().mockResolvedValue(undefined)
    requireSessionAccess.mockReset().mockResolvedValue(undefined)
    fromMock.mockReset()
  })
  afterEach(() => vi.clearAllMocks())

  it('returns empty columns + rows when no entries are passed', async () => {
    const result = await getComparisonMatrix({
      entries: [],
      assessmentIds: ['a1'],
      granularity: 'factors_or_constructs',
    })
    expect(result).toEqual({ columns: [], rows: [] })
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('authorises every participant id and propagates auth rejection', async () => {
    requireParticipantAccess.mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(
      getComparisonMatrix({
        entries: [{ campaignParticipantId: 'cp1' }],
        assessmentIds: ['a1'],
        granularity: 'factors_or_constructs',
      }),
    ).rejects.toThrow('Unauthorized')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('returns identity-only rows when no assessmentIds are passed', async () => {
    fromMock.mockImplementation(
      fromRouter({
        campaign_participants: [
          { id: 'cp1', email: 'sam@x.com', first_name: 'Sam', last_name: 'Lee' },
        ],
      }),
    )
    const result = await getComparisonMatrix({
      entries: [{ campaignParticipantId: 'cp1' }],
      assessmentIds: [],
      granularity: 'factors_or_constructs',
    })
    expect(result.columns).toEqual([])
    expect(result.rows).toEqual([
      {
        entryId: 'cp1:0',
        campaignParticipantId: 'cp1',
        participantName: 'Sam Lee',
        participantEmail: 'sam@x.com',
        perAssessment: [],
      },
    ])
  })

  it('happy path: builds factor-level groups, picks most-recent-completed sessions, and rolls up scores', async () => {
    fromMock.mockImplementation(
      fromRouter({
        campaign_participants: [
          { id: 'cp1', email: 'sam@x.com', first_name: 'Sam', last_name: 'Lee' },
        ],
        participant_sessions: [
          {
            id: 'sess1-old',
            campaign_participant_id: 'cp1',
            assessment_id: 'a1',
            status: 'completed',
            started_at: '2026-03-01T00:00:00Z',
            completed_at: '2026-03-02T00:00:00Z',
          },
          {
            id: 'sess1-new',
            campaign_participant_id: 'cp1',
            assessment_id: 'a1',
            status: 'completed',
            started_at: '2026-04-01T00:00:00Z',
            completed_at: '2026-04-02T00:00:00Z',
          },
        ],
        assessments: [{ id: 'a1', title: 'Leadership', scoring_level: 'factor' }],
        assessment_factors: [
          {
            factor_id: 'f1',
            factors: { id: 'f1', name: 'Persuasion', dimension_id: 'd1', dimensions: { id: 'd1', name: 'Influence' } },
          },
          {
            factor_id: 'f2',
            factors: { id: 'f2', name: 'Empathy', dimension_id: 'd1', dimensions: { id: 'd1', name: 'Influence' } },
          },
        ],
        participant_scores: [
          { session_id: 'sess1-new', factor_id: 'f1', construct_id: null, scaled_score: 80 },
          { session_id: 'sess1-new', factor_id: 'f2', construct_id: null, scaled_score: 70 },
          { session_id: 'sess1-old', factor_id: 'f1', construct_id: null, scaled_score: 50 },
        ],
      }),
    )

    const result = await getComparisonMatrix({
      entries: [{ campaignParticipantId: 'cp1' }],
      assessmentIds: ['a1'],
      granularity: 'factors_or_constructs',
    })

    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].rollup.id).toBe('d1')
    expect(result.columns[0].rollup.name).toBe('Influence')
    expect(result.columns[0].children.map((c) => c.id).sort()).toEqual(['f1', 'f2'])

    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.participantName).toBe('Sam Lee')
    const a = row.perAssessment[0]
    expect(a.sessionId).toBe('sess1-new')
    expect(a.attemptNumber).toBe(2)
    expect(a.cells.f1).toBe(80)
    expect(a.cells.f2).toBe(70)
    expect(a.cells.d1).toBe(75)
  })

  it('returns dashed cells when no completed session exists for a chosen assessment', async () => {
    fromMock.mockImplementation(
      fromRouter({
        campaign_participants: [
          { id: 'cp1', email: 'sam@x.com', first_name: 'Sam', last_name: 'Lee' },
        ],
        participant_sessions: [
          {
            id: 'sess-ip',
            campaign_participant_id: 'cp1',
            assessment_id: 'a1',
            status: 'in_progress',
            started_at: '2026-04-01T00:00:00Z',
            completed_at: null,
          },
        ],
        assessments: [{ id: 'a1', title: 'Leadership', scoring_level: 'factor' }],
        assessment_factors: [
          {
            factor_id: 'f1',
            factors: { id: 'f1', name: 'Persuasion', dimension_id: 'd1', dimensions: { id: 'd1', name: 'Influence' } },
          },
        ],
        participant_scores: [],
      }),
    )

    const result = await getComparisonMatrix({
      entries: [{ campaignParticipantId: 'cp1' }],
      assessmentIds: ['a1'],
      granularity: 'factors_or_constructs',
    })
    const a = result.rows[0].perAssessment[0]
    expect(a.sessionId).toBeNull()
    expect(a.attemptNumber).toBeNull()
    expect(a.cells.f1).toBeNull()
    expect(a.cells.d1).toBeNull()
  })

  it('honours an explicitly-supplied sessionId and authorises it', async () => {
    fromMock.mockImplementation(
      fromRouter({
        campaign_participants: [
          { id: 'cp1', email: 'sam@x.com', first_name: 'Sam', last_name: 'Lee' },
        ],
        participant_sessions: [
          {
            id: 'sess-A',
            campaign_participant_id: 'cp1',
            assessment_id: 'a1',
            status: 'completed',
            started_at: '2026-04-01T00:00:00Z',
            completed_at: '2026-04-02T00:00:00Z',
          },
          {
            id: 'sess-B',
            campaign_participant_id: 'cp1',
            assessment_id: 'a1',
            status: 'completed',
            started_at: '2026-04-10T00:00:00Z',
            completed_at: '2026-04-11T00:00:00Z',
          },
        ],
        assessments: [{ id: 'a1', title: 'Leadership', scoring_level: 'factor' }],
        assessment_factors: [
          {
            factor_id: 'f1',
            factors: { id: 'f1', name: 'Persuasion', dimension_id: 'd1', dimensions: { id: 'd1', name: 'Influence' } },
          },
        ],
        participant_scores: [
          { session_id: 'sess-A', factor_id: 'f1', construct_id: null, scaled_score: 60 },
          { session_id: 'sess-B', factor_id: 'f1', construct_id: null, scaled_score: 90 },
        ],
      }),
    )

    const result = await getComparisonMatrix({
      entries: [
        {
          campaignParticipantId: 'cp1',
          sessionIdsByAssessment: { a1: 'sess-A' },
        },
      ],
      assessmentIds: ['a1'],
      granularity: 'factors_or_constructs',
    })
    expect(requireSessionAccess).toHaveBeenCalledWith('sess-A')
    expect(result.rows[0].perAssessment[0].sessionId).toBe('sess-A')
    expect(result.rows[0].perAssessment[0].cells.f1).toBe(60)
  })

  it('handles construct-level assessments', async () => {
    fromMock.mockImplementation(
      fromRouter({
        campaign_participants: [
          { id: 'cp1', email: 'sam@x.com', first_name: 'Sam', last_name: 'Lee' },
        ],
        participant_sessions: [
          {
            id: 's1',
            campaign_participant_id: 'cp1',
            assessment_id: 'a2',
            status: 'completed',
            started_at: '2026-04-01T00:00:00Z',
            completed_at: '2026-04-02T00:00:00Z',
          },
        ],
        assessments: [{ id: 'a2', title: 'Cognitive', scoring_level: 'construct' }],
        assessment_constructs: [
          {
            construct_id: 'c1',
            dimension_id: 'd9',
            constructs: { id: 'c1', name: 'Verbal' },
            dimensions: { id: 'd9', name: 'Reasoning' },
          },
          {
            construct_id: 'c2',
            dimension_id: 'd9',
            constructs: { id: 'c2', name: 'Numerical' },
            dimensions: { id: 'd9', name: 'Reasoning' },
          },
        ],
        participant_scores: [
          { session_id: 's1', factor_id: null, construct_id: 'c1', scaled_score: 88 },
          { session_id: 's1', factor_id: null, construct_id: 'c2', scaled_score: 92 },
        ],
      }),
    )

    const result = await getComparisonMatrix({
      entries: [{ campaignParticipantId: 'cp1' }],
      assessmentIds: ['a2'],
      granularity: 'factors_or_constructs',
    })
    expect(result.columns[0].rollup.name).toBe('Reasoning')
    expect(result.columns[0].children.map((c) => c.level)).toEqual(['construct', 'construct'])
    expect(result.rows[0].perAssessment[0].cells.c1).toBe(88)
    expect(result.rows[0].perAssessment[0].cells.d9).toBe(90)
  })
})
