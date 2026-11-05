import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ notice: vi.fn(), insert: vi.fn(), rpc: vi.fn(), removed: vi.fn() }))
vi.mock('@/lib/dal/participant-privacy', () => ({ getEnrollmentPrivacyNotice: state.notice }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: state.rpc, from: (table: string) => {
  const query: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'is']) query[method] = () => query
  query.insert = (record: unknown) => { state.insert(record); return query }
  query.delete = () => { state.removed(); return query }
  query.single = async () => ({ data: table === 'campaign_access_links'
    ? { id: 'link', campaign_id: '11111111-1111-4111-8111-111111111111', max_uses: null }
    : table === 'campaigns' ? { status: 'active', client_id: null }
    : { id: '22222222-2222-4222-8222-222222222222', access_token: 'a'.repeat(64) }, error: null })
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve)
  return query
} }) }))
import { registerViaLink } from '@/app/actions/assess'
const noticeId = '33333333-3333-4333-8333-333333333333'
const participant = { email: 'synthetic@example.invalid', firstName: 'Synthetic', lastName: 'Participant' }
const notice = { id: noticeId, researchChoiceEnabled: false }
const accepted = { ...participant, privacyNoticeVersionId: noticeId, privacyAcknowledged: true }
beforeEach(() => {
  state.notice.mockResolvedValue(notice)
  state.rpc.mockImplementation(async name => ({ data: name === 'increment_access_link_usage', error: null }))
})
describe('registration privacy acknowledgement', () => {
  it.each([participant, { ...accepted, privacyAcknowledged: false }, { ...accepted, privacyNoticeVersionId: '44444444-4444-4444-8444-444444444444' }])('rejects absent, unchecked or stale acknowledgement before creating a participant', async input => {
    expect(await registerViaLink('synthetic-link', input)).toHaveProperty('error')
    expect(state.insert).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled()
  })
  it('fails closed when the published notice cannot be loaded', async () => {
    state.notice.mockRejectedValue(new Error('private detail'))
    expect(await registerViaLink('synthetic-link', accepted)).toEqual({ error: 'Assessment privacy information is unavailable. Please try again.' })
    expect(state.insert).not.toHaveBeenCalled()
  })
  it('preserves registration without any assigned notice', async () => {
    state.notice.mockResolvedValue(null)
    expect(await registerViaLink('synthetic-link', participant)).toEqual({ accessToken: 'a'.repeat(64) })
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith('increment_access_link_usage', { p_link_id: 'link' })
  })
  it('saves the server-selected notice after capacity succeeds and never infers research permission', async () => {
    expect(await registerViaLink('synthetic-link', { ...accepted, researchConsent: true })).toEqual({ accessToken: 'a'.repeat(64) })
    expect(state.notice).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111')
    expect(state.rpc.mock.calls.map(call => call[0])).toEqual(['increment_access_link_usage', 'privacy_record_receipt'])
    expect(state.rpc).toHaveBeenLastCalledWith('privacy_record_receipt', { p_participant: '22222222-2222-4222-8222-222222222222', p_notice: noticeId, p_research: null })
  })
  it.each([undefined, false, true])('records the separate research choice only when offered (%s)', async choice => {
    state.notice.mockResolvedValue({ ...notice, researchChoiceEnabled: true })
    await registerViaLink('synthetic-link', { ...accepted, researchConsent: choice })
    expect(state.rpc).toHaveBeenLastCalledWith('privacy_record_receipt', expect.objectContaining({ p_research: choice ?? false }))
  })
  it.each(['returned', 'thrown'])('keeps the issued token and requires the consent page after a %s receipt failure', async kind => {
    state.rpc.mockImplementation(async name => {
      if (name === 'increment_access_link_usage') return { data: true, error: null }
      if (kind === 'thrown') throw new Error('private transport detail')
      return { error: { message: 'private receipt detail' } }
    })
    expect(await registerViaLink('synthetic-link', accepted)).toEqual({ accessToken: 'a'.repeat(64), requiresPrivacyAcknowledgement: true })
    expect(state.insert).toHaveBeenCalledTimes(1); expect(state.removed).not.toHaveBeenCalled()
  })
  it('does not record a receipt when the atomic link-capacity check fails', async () => {
    state.rpc.mockResolvedValue({ data: false, error: null })
    expect(await registerViaLink('synthetic-link', accepted)).toHaveProperty('error')
    expect(state.rpc).toHaveBeenCalledExactlyOnceWith('increment_access_link_usage', { p_link_id: 'link' })
    expect(state.removed).toHaveBeenCalledOnce()
  })
})
