import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PERSONALITY_PROFILE_ASSESSMENT_ID } from '@/lib/instrument/ipip-neo-120/catalogue'
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn(), throwActionError: vi.fn() }))

const mocks = vi.hoisted(() => ({ access: vi.fn(), scope: vi.fn(), campaigns: vi.fn(), from: vi.fn(), predicates: vi.fn() }))
vi.mock('@/lib/auth/authorization', () => ({
  AuthorizationError: class extends Error {}, requireParticipantAccess: mocks.access,
  resolveAuthorizedScope: mocks.scope, getAccessibleCampaignIds: mocks.campaigns,
}))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: mocks.from }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: () => { throw new Error('RLS hides clientless sessions') } }))
vi.mock('@/lib/auth/support-sessions', () => ({ logSupportSessionDataAccess: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

import { getParticipants, getParticipantSessions, getParticipantActivity } from '@/app/actions/participants'
import { AuthorizationError } from '@/lib/auth/authorization'

const participantId = '11111111-1111-4111-8111-111111111111'
const scope = { isPlatformAdmin: false }
const access = { scope, campaignId: 'campaign', clientId: null, partnerId: 'partner', confidentialityMode: 'standard' }
const session = { id: 'session', assessment_id: 'assessment', status: 'completed', completed_at: '2026-10-13T05:00:00Z',
  participant_scores: [{ factor_id: 'factor', scaled_score: 50, raw_score: 50, scoring_method: 'ctt' }] }
function query(data: unknown) {
  const result = { data, error: null, count: 1 }
  const chain = {
    select: () => chain, eq: (key: string, value: unknown) => { mocks.predicates(key, value); return chain },
    in: (key: string, value: unknown) => { mocks.predicates(key, value); return chain },
    is: () => chain, order: () => chain, range: () => chain,
    single: async () => result,
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  return chain
}
beforeEach(() => {
  session.assessment_id = 'assessment'
  mocks.access.mockResolvedValue(access)
  mocks.scope.mockResolvedValue(scope)
  mocks.campaigns.mockResolvedValue(['campaign'])
  mocks.from.mockImplementation((table: string) => query(table === 'participant_sessions' ? [session] : [{
    id: participantId, email: 'synthetic@example.invalid', campaigns: { title: 'Campaign' }, participant_sessions: [session],
  }]))
})
describe('clientless campaign participant session visibility', () => {
  it('loads completed sessions and scores through the real DAL under the authorized participant predicate', async () => {
    const sessions = await getParticipantSessions(participantId)
    expect(sessions).toHaveLength(1)
    expect(sessions[0].status).toBe('completed')
    expect(sessions[0].scores[0].scaledScore).toBe(50)
    expect(mocks.access).toHaveBeenCalledWith(participantId)
    expect(mocks.predicates).toHaveBeenCalledWith('campaign_participant_id', participantId)
  })
  it('retains completion metadata but withholds aggregate-only scores', async () => {
    mocks.access.mockResolvedValue({ ...access, confidentialityMode: 'aggregate_only' })
    expect(await getParticipantSessions(participantId)).toEqual([expect.objectContaining({ status: 'completed', scores: [] })])
  })
  it('shows quality status only for sessions from the authorised participant listing', async () => {
    session.assessment_id = PERSONALITY_PROFILE_ASSESSMENT_ID
    mocks.from.mockImplementation((table: string) => query(table === 'participant_sessions' ? [session] : [{ session_id: 'session', status: 'review_recommended' }]))
    expect((await getParticipantSessions(participantId))[0].responseQualityStatus).toBe('review_recommended')
    expect(mocks.predicates).toHaveBeenCalledWith('session_id', ['session'])
  })
  it('does not fetch individual quality flags for an aggregate-only tenant viewer', async () => {
    session.assessment_id = PERSONALITY_PROFILE_ASSESSMENT_ID
    mocks.access.mockResolvedValue({ ...access, confidentialityMode: 'aggregate_only' })
    const rows = await getParticipantSessions(participantId)
    expect(rows[0].responseQualityStatus).toBeUndefined()
    expect(mocks.from).not.toHaveBeenCalledWith('participant_response_quality_results')
  })
  it('keeps the session list usable and marks unavailable quality data explicitly', async () => {
    session.assessment_id = PERSONALITY_PROFILE_ASSESSMENT_ID
    mocks.from.mockImplementation((table: string) => { if (table === 'participant_response_quality_results') throw new Error('Synthetic storage unavailable'); return query([session]) })
    const rows = await getParticipantSessions(participantId)
    expect(rows[0]).toMatchObject({ status: 'completed', responseQualityUnavailable: true })
    expect(rows[0].scores).toHaveLength(1)
  })
  it('shows completed session counts in a scoped participant list', async () => {
    const result = await getParticipants()
    expect(result.data[0]).toMatchObject({ sessionCount: 1, completedSessionCount: 1 })
    expect(mocks.predicates).toHaveBeenCalledWith('campaign_id', 'campaign')
  })
  it('does not open the admin query for an empty workspace scope', async () => {
    mocks.campaigns.mockResolvedValue([])
    expect(await getParticipants()).toEqual({ data: [], total: 0 })
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('preserves activity milestones for clientless partner sessions', async () => {
    mocks.from.mockImplementation((table: string) => query(table === 'participant_sessions' ? [session] : { completed_at: '2026-10-13T05:00:00Z' }))
    expect((await getParticipantActivity(participantId)).map(event => event.type)).toEqual(['session_completed', 'completed'])
    expect(mocks.predicates).toHaveBeenCalledWith('campaign_participant_id', participantId)
  })
  it('denies sessions and activity outside the workspace before querying', async () => {
    mocks.access.mockRejectedValue(new AuthorizationError('Unauthorized'))
    expect(await getParticipantSessions(participantId)).toEqual([])
    expect(await getParticipantActivity(participantId)).toEqual([])
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
