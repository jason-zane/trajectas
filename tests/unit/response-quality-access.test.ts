import { beforeEach, expect, it, vi } from 'vitest'
import { QUALITY_QUESTIONS, QUALITY_MODULE_VERSION } from '@/lib/instrument/ipip-neo-120/response-quality'
const mocks = vi.hoisted(() => ({ access: vi.fn(), individual: vi.fn(), manage: vi.fn(), participant: vi.fn(), admin: vi.fn(), from: vi.fn(), rpc: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: mocks.admin }))
vi.mock('@/lib/auth/authorization', () => ({ requireSessionAccess: mocks.access, assertIndividualResultsAccess: mocks.individual, canManageCampaign: mocks.manage }))
vi.mock('@/lib/auth/participant-runtime', () => ({ requireParticipantRuntimeSessionAccess: mocks.participant }))
import { getSessionResponseQuality, recordResponseQualityReview, getParticipantQualityModule, saveParticipantQualityAnswer, isQualityModuleComplete } from '@/lib/dal/response-quality'
const ids = { sessionId: '11111111-1111-4111-8111-111111111111', resultId: '22222222-2222-4222-8222-222222222222', reviewId: '33333333-3333-4333-8333-333333333333' }
beforeEach(() => {
  mocks.access.mockResolvedValue({ scope: { actor: { id: 'actor' } }, partnerId: 'partner', clientId: 'client', confidentialityMode: 'standard' })
  mocks.individual.mockReturnValue(undefined); mocks.manage.mockReturnValue(true); mocks.participant.mockResolvedValue({})
  mocks.admin.mockReturnValue({ from: mocks.from, rpc: mocks.rpc })
})
it('rejects an out-of-workspace read before opening the data client', async () => {
  mocks.access.mockRejectedValue(new Error('Wrong workspace'))
  await expect(getSessionResponseQuality(ids.sessionId)).rejects.toThrow('Wrong workspace')
  expect(mocks.admin).not.toHaveBeenCalled()
})
it('withholds evidence and review writes under aggregate-only confidentiality', async () => {
  mocks.individual.mockImplementation(() => { throw new Error('Aggregate only') })
  await expect(getSessionResponseQuality(ids.sessionId)).rejects.toThrow('Aggregate only')
  await expect(recordResponseQualityReview({ ...ids, decision: 'accepted', notes: 'Reviewed in context' })).rejects.toThrow('Aggregate only')
  expect(mocks.admin).not.toHaveBeenCalled()
})
it('ordinary readers cannot record a review', async () => {
  mocks.manage.mockReturnValue(false)
  await expect(recordResponseQualityReview({ ...ids, decision: 'accepted', notes: 'Reviewed in context' })).rejects.toThrow('permission')
  expect(mocks.admin).not.toHaveBeenCalled()
})
it('binds the review to the authorised session before attempting an insert', async () => {
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), single: async () => ({ data: null, error: null }) }
  mocks.from.mockReturnValue(query)
  await expect(recordResponseQualityReview({ ...ids, decision: 'accepted', notes: 'Reviewed in context' })).rejects.toThrow('not found')
  expect(query.eq).toHaveBeenCalledWith('session_id', ids.sessionId)
  expect(mocks.from).not.toHaveBeenCalledWith('response_quality_reviews')
})
it('checks participant-token ownership before supplementary reads or saves', async () => {
  mocks.participant.mockRejectedValue(new Error('Not your session'))
  await expect(getParticipantQualityModule('token', ids.sessionId)).rejects.toThrow('Not your session')
  await expect(saveParticipantQualityAnswer({ token: 'token', sessionId: ids.sessionId, questionId: 'attention_agree', value: 4, revision: 0 })).rejects.toThrow('Not your session')
  expect(mocks.admin).not.toHaveBeenCalled()
})
it('preserves a legacy attempt with no supplementary assignment', () => {
  expect(isQualityModuleComplete(null)).toBe(true)
  expect(isQualityModuleComplete({ version: QUALITY_MODULE_VERSION, questions: QUALITY_QUESTIONS, answers: {}, revision: 0 })).toBe(false)
})
