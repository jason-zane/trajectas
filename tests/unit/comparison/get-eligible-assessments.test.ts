import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const requireParticipantAccess = vi.fn()
const fromMock = vi.fn()

vi.mock('@/lib/auth/authorization', () => ({
  requireParticipantAccess: (id: string) => requireParticipantAccess(id),
  AuthorizationError: class AuthorizationError extends Error {},
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: fromMock }),
}))

import { getEligibleAssessmentsForParticipants } from '@/app/actions/comparison'

function selectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data, error }),
    }),
  }
}

describe('getEligibleAssessmentsForParticipants', () => {
  beforeEach(() => {
    requireParticipantAccess.mockReset().mockResolvedValue(undefined)
    fromMock.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list for empty input without hitting the DB', async () => {
    const result = await getEligibleAssessmentsForParticipants([])
    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('aggregates per-assessment completed-session counts, sorted by name', async () => {
    fromMock.mockReturnValue(
      selectChain([
        { assessment_id: 'a1', status: 'completed', assessments: { id: 'a1', title: 'Cognitive' } },
        { assessment_id: 'a1', status: 'completed', assessments: { id: 'a1', title: 'Cognitive' } },
        { assessment_id: 'a1', status: 'in_progress', assessments: { id: 'a1', title: 'Cognitive' } },
        { assessment_id: 'a2', status: 'completed', assessments: { id: 'a2', title: 'Behavioural' } },
      ]),
    )
    const result = await getEligibleAssessmentsForParticipants(['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'])
    expect(result).toEqual([
      { assessmentId: 'a2', assessmentName: 'Behavioural', completedSessionCount: 1 },
      { assessmentId: 'a1', assessmentName: 'Cognitive', completedSessionCount: 2 },
    ])
  })

  it('skips rows whose joined assessment is null', async () => {
    fromMock.mockReturnValue(
      selectChain([
        { assessment_id: 'a1', status: 'completed', assessments: null },
        { assessment_id: 'a2', status: 'completed', assessments: { id: 'a2', title: 'Behavioural' } },
      ]),
    )
    const result = await getEligibleAssessmentsForParticipants(['11111111-1111-1111-1111-111111111111'])
    expect(result.map((r) => r.assessmentId)).toEqual(['a2'])
  })

  it('authorizes every participant id before querying', async () => {
    fromMock.mockReturnValue(selectChain([]))
    await getEligibleAssessmentsForParticipants(['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'])
    expect(requireParticipantAccess).toHaveBeenCalledTimes(3)
    expect(requireParticipantAccess).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111')
    expect(requireParticipantAccess).toHaveBeenCalledWith('33333333-3333-3333-3333-333333333333')
  })

  it('propagates an authorization rejection', async () => {
    requireParticipantAccess.mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(
      getEligibleAssessmentsForParticipants(['11111111-1111-1111-1111-111111111111']),
    ).rejects.toThrow('Unauthorized')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throws when the DB returns an error', async () => {
    fromMock.mockReturnValue(selectChain(null, { message: 'boom' }))
    await expect(getEligibleAssessmentsForParticipants(['11111111-1111-1111-1111-111111111111'])).rejects.toBeTruthy()
  })
})
