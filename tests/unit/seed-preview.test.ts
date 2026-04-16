import { describe, it, expect, vi } from 'vitest'
import {
  PREVIEW_SAMPLE_CLIENT_ID,
  ensurePreviewSampleClient,
  seedAssessmentPreview,
  hasPreviewSeed,
  getPreviewSessionId,
} from '@/lib/sample-data/seed-preview'
import { synthScore, weightedMean } from '@/lib/sample-data/score-synth'
import { makeMockDb } from './helpers/supabase-mock'

describe('ensurePreviewSampleClient', () => {
  it('returns the well-known client id when the row exists', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: PREVIEW_SAMPLE_CLIENT_ID },
              error: null,
            }),
          }),
        }),
      }),
    }
    // @ts-expect-error — duck-typed client for unit test
    const id = await ensurePreviewSampleClient(db)
    expect(id).toBe(PREVIEW_SAMPLE_CLIENT_ID)
  })

  it('throws when the Sample Data client row is missing', async () => {
    const db = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    }
    await expect(
      // @ts-expect-error — duck-typed
      ensurePreviewSampleClient(db),
    ).rejects.toThrow(/migration/)
  })
})

describe('seedAssessmentPreview (construct-level)', () => {
  it('creates campaign/participant/session and one score row per construct', async () => {
    const constructIds = [
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    ]
    const mock = makeMockDb({
      clients: { maybeSingle: { data: { id: PREVIEW_SAMPLE_CLIENT_ID } } },
      assessments: {
        maybeSingle: {
          data: { id: 'assess-1', title: 'Test', scoring_level: 'construct' },
        },
      },
      campaigns: {
        maybeSingle: { data: null },
        single: { data: { id: 'camp-1' } },
      },
      campaign_participants: {
        maybeSingle: { data: null },
        single: { data: { id: 'part-1' } },
      },
      participant_sessions: {
        maybeSingle: { data: null },
        single: { data: { id: 'sess-1' } },
      },
      assessment_constructs: {
        data: constructIds.map((construct_id) => ({ construct_id })),
      },
      participant_scores: { data: null },
    })

    const result = await seedAssessmentPreview(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mock.db as any,
      'assess-1',
    )

    expect(result.sessionId).toBe('sess-1')
    expect(result.scoreCount).toBe(2)

    const scoreInsert = mock.insertCalls.find((c) => c.table === 'participant_scores')
    expect(scoreInsert).toBeDefined()
    const rows = scoreInsert!.rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[0].scoring_level).toBe('construct')
    expect(rows[0].session_id).toBe('sess-1')
    expect(rows[0].construct_id).toBe(constructIds[0])
    expect(rows[0].scaled_score).toBe(synthScore(constructIds[0]))
    expect(rows[1].scaled_score).toBe(synthScore(constructIds[1]))

    // Session delete was called before the insert (clear-and-reinsert)
    expect(mock.deleteCalls.some((c) => c.table === 'participant_scores')).toBe(true)
  })
})

describe('seedAssessmentPreview (factor-level)', () => {
  it('writes one score row per factor using weighted mean of child constructs', async () => {
    const factorId = 'fffffff1-fff1-fff1-fff1-ffffffffffff'
    const constructA = 'aaaaaaa1-aaa1-aaa1-aaa1-aaaaaaaaaaaa'
    const constructB = 'bbbbbbb1-bbb1-bbb1-bbb1-bbbbbbbbbbbb'
    const mock = makeMockDb({
      clients: { maybeSingle: { data: { id: PREVIEW_SAMPLE_CLIENT_ID } } },
      assessments: {
        maybeSingle: {
          data: { id: 'assess-2', title: 'Factor Test', scoring_level: 'factor' },
        },
      },
      campaigns: {
        maybeSingle: { data: null },
        single: { data: { id: 'camp-2' } },
      },
      campaign_participants: {
        maybeSingle: { data: null },
        single: { data: { id: 'part-2' } },
      },
      participant_sessions: {
        maybeSingle: { data: null },
        single: { data: { id: 'sess-2' } },
      },
      assessment_factors: { data: [{ factor_id: factorId }] },
      factor_constructs: {
        data: [
          { factor_id: factorId, construct_id: constructA, weight: 1 },
          { factor_id: factorId, construct_id: constructB, weight: 3 },
        ],
      },
      participant_scores: { data: null },
    })

    const result = await seedAssessmentPreview(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mock.db as any,
      'assess-2',
    )

    expect(result.scoreCount).toBe(1)
    const scoreInsert = mock.insertCalls.find((c) => c.table === 'participant_scores')
    expect(scoreInsert).toBeDefined()
    const rows = scoreInsert!.rows as Array<Record<string, unknown>>
    expect(rows).toHaveLength(1)
    expect(rows[0].factor_id).toBe(factorId)
    expect(rows[0].scoring_level).toBe('factor')

    const expected = weightedMean([
      { value: synthScore(constructA), weight: 1 },
      { value: synthScore(constructB), weight: 3 },
    ])
    expect(rows[0].scaled_score).toBe(expected)
  })

  it('falls back to synthScore(factorId) when a factor has no constructs', async () => {
    const factorId = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
    const mock = makeMockDb({
      clients: { maybeSingle: { data: { id: PREVIEW_SAMPLE_CLIENT_ID } } },
      assessments: {
        maybeSingle: {
          data: { id: 'assess-3', title: 'Lone Factor', scoring_level: 'factor' },
        },
      },
      campaigns: { maybeSingle: { data: null }, single: { data: { id: 'c' } } },
      campaign_participants: { maybeSingle: { data: null }, single: { data: { id: 'p' } } },
      participant_sessions: { maybeSingle: { data: null }, single: { data: { id: 's' } } },
      assessment_factors: { data: [{ factor_id: factorId }] },
      factor_constructs: { data: [] },
      participant_scores: { data: null },
    })

    await seedAssessmentPreview(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mock.db as any,
      'assess-3',
    )
    const ins = mock.insertCalls.find((c) => c.table === 'participant_scores')!
    expect((ins.rows as Array<Record<string, unknown>>)[0].scaled_score).toBe(synthScore(factorId))
  })
})

describe('seedAssessmentPreview idempotency', () => {
  it('reuses existing campaign/participant/session on second run and re-writes scores', async () => {
    const constructId = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
    const mock = makeMockDb({
      clients: { maybeSingle: { data: { id: PREVIEW_SAMPLE_CLIENT_ID } } },
      assessments: {
        maybeSingle: {
          data: { id: 'assess-idem', title: 'Idempotent', scoring_level: 'construct' },
        },
      },
      // Pre-existing rows are found on the second run
      campaigns: { maybeSingle: { data: { id: 'existing-camp' } } },
      campaign_participants: { maybeSingle: { data: { id: 'existing-part' } } },
      participant_sessions: { maybeSingle: { data: { id: 'existing-sess' } } },
      assessment_constructs: { data: [{ construct_id: constructId }] },
      participant_scores: { data: null },
    })

    const result = await seedAssessmentPreview(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mock.db as any,
      'assess-idem',
    )

    expect(result.campaignId).toBe('existing-camp')
    expect(result.participantId).toBe('existing-part')
    expect(result.sessionId).toBe('existing-sess')

    // No insert for the reused tables
    expect(mock.insertCalls.find((c) => c.table === 'campaigns')).toBeUndefined()
    expect(mock.insertCalls.find((c) => c.table === 'campaign_participants')).toBeUndefined()
    expect(mock.insertCalls.find((c) => c.table === 'participant_sessions')).toBeUndefined()
    // Scores got cleared and re-inserted
    expect(mock.deleteCalls.some((c) => c.table === 'participant_scores')).toBe(true)
    expect(mock.insertCalls.find((c) => c.table === 'participant_scores')).toBeDefined()
  })
})

describe('hasPreviewSeed / getPreviewSessionId', () => {
  it('hasPreviewSeed returns true when a session row exists', async () => {
    const mock = makeMockDb({
      participant_sessions: { maybeSingle: { data: { id: 'sess-x' } } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await hasPreviewSeed(mock.db as any, 'a1')).toBe(true)
  })

  it('hasPreviewSeed returns false when no session row exists', async () => {
    const mock = makeMockDb({
      participant_sessions: { maybeSingle: { data: null } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await hasPreviewSeed(mock.db as any, 'a1')).toBe(false)
  })

  it('getPreviewSessionId returns the session id when present', async () => {
    const mock = makeMockDb({
      participant_sessions: { maybeSingle: { data: { id: 'sess-y' } } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getPreviewSessionId(mock.db as any, 'a1')).toBe('sess-y')
  })

  it('getPreviewSessionId returns null when no session row exists', async () => {
    const mock = makeMockDb({
      participant_sessions: { maybeSingle: { data: null } },
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getPreviewSessionId(mock.db as any, 'a1')).toBeNull()
  })
})
