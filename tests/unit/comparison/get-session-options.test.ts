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

import { getSessionOptionsForRow } from '@/app/actions/comparison'

function selectChain(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data, error }),
        }),
      }),
    }),
  }
}

describe('getSessionOptionsForRow', () => {
  beforeEach(() => {
    requireParticipantAccess.mockReset().mockResolvedValue(undefined)
    fromMock.mockReset()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('returns an empty list when no assessmentIds are passed without authorising', async () => {
    const result = await getSessionOptionsForRow('cp1', [])
    expect(result).toEqual([])
    expect(requireParticipantAccess).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('numbers attempts per assessment in started_at ascending order', async () => {
    fromMock.mockReturnValue(
      selectChain([
        { id: 's1', assessment_id: 'a1', started_at: '2026-04-01T00:00:00Z', status: 'completed', assessments: { title: 'Cog' } },
        { id: 's2', assessment_id: 'a1', started_at: '2026-04-05T00:00:00Z', status: 'in_progress', assessments: { title: 'Cog' } },
        { id: 's3', assessment_id: 'a2', started_at: '2026-04-03T00:00:00Z', status: 'completed', assessments: { title: 'Beh' } },
      ]),
    )
    const result = await getSessionOptionsForRow('cp1', ['a1', 'a2'])
    expect(result).toEqual([
      { sessionId: 's1', assessmentId: 'a1', assessmentName: 'Cog', attemptNumber: 1, startedAt: '2026-04-01T00:00:00Z', status: 'completed' },
      { sessionId: 's2', assessmentId: 'a1', assessmentName: 'Cog', attemptNumber: 2, startedAt: '2026-04-05T00:00:00Z', status: 'in_progress' },
      { sessionId: 's3', assessmentId: 'a2', assessmentName: 'Beh', attemptNumber: 1, startedAt: '2026-04-03T00:00:00Z', status: 'completed' },
    ])
  })

  it('handles a missing embedded assessment by returning an empty name', async () => {
    fromMock.mockReturnValue(
      selectChain([
        { id: 's1', assessment_id: 'a1', started_at: '2026-04-01T00:00:00Z', status: 'completed', assessments: null },
      ]),
    )
    const [opt] = await getSessionOptionsForRow('cp1', ['a1'])
    expect(opt.assessmentName).toBe('')
  })

  it('authorises the participant before querying', async () => {
    fromMock.mockReturnValue(selectChain([]))
    await getSessionOptionsForRow('cp1', ['a1'])
    expect(requireParticipantAccess).toHaveBeenCalledWith('cp1')
  })

  it('propagates an authorisation rejection', async () => {
    requireParticipantAccess.mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(getSessionOptionsForRow('cp1', ['a1'])).rejects.toThrow('Unauthorized')
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('throws when the DB returns an error', async () => {
    fromMock.mockReturnValue(selectChain(null, { message: 'boom' }))
    await expect(getSessionOptionsForRow('cp1', ['a1'])).rejects.toBeTruthy()
  })
})
