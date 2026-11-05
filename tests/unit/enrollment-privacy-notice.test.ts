import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ settings: null as unknown, notice: null as unknown, participant: null as unknown, receipts: [] as unknown[], error: null as unknown, open: vi.fn(), eq: vi.fn(), from: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => {
  state.open()
  return { from: (table: string) => {
    state.from(table)
    const query: Record<string, unknown> = {}
    query.select = () => query
    query.eq = (column: string, value: unknown) => { state.eq(table, column, value); return query }
    query.is = () => query
    query.limit = async () => ({ data: state.receipts, error: state.error })
    query.maybeSingle = query.single = async () => ({ data: table === 'campaign_privacy_settings' ? state.settings : table === 'campaign_participants' ? state.participant : state.notice, error: state.error })
    return query
  } }
} }))
import { getEnrollmentPrivacyNotice, getParticipantPrivacyState } from '@/lib/dal/participant-privacy'
const campaign = '11111111-1111-4111-8111-111111111111', noticeId = '22222222-2222-4222-8222-222222222222'
beforeEach(() => {
  state.settings = { notice_version_id: noticeId, notice_effective_at: '2020-01-01T00:00:00Z' }
  state.notice = { id: noticeId, title: 'Notice', body: 'Information', acknowledgement_label: 'I have read this.', research_label: 'Optional research', research_choice_enabled: false }
  state.participant = { created_at: '2021-01-01T00:00:00Z' }
  state.receipts = []
  state.error = null
})
describe('enrollment notice boundary', () => {
  it('only reads the validated campaign and its published participant notice', async () => {
    expect(await getEnrollmentPrivacyNotice(campaign)).toEqual({ id: noticeId, title: 'Notice', body: 'Information', acknowledgementLabel: 'I have read this.', researchLabel: 'Optional research', researchChoiceEnabled: false })
    expect(state.eq).toHaveBeenCalledWith('campaign_privacy_settings', 'campaign_id', campaign)
    for (const [column, value] of [['id', noticeId], ['status', 'published'], ['audience', 'participant']]) expect(state.eq).toHaveBeenCalledWith('privacy_notice_versions', column, value)
  })
  it.each([null, { notice_version_id: null }, { notice_version_id: noticeId, notice_effective_at: '2999-01-01T00:00:00Z' }])('does not expose an unassigned or future notice', async setting => {
    state.settings = setting
    expect(await getEnrollmentPrivacyNotice(campaign)).toBeNull()
    expect(state.from).not.toHaveBeenCalledWith('privacy_notice_versions')
  })
  it.each(['settings error', 'missing published notice'])('fails closed on %s', async kind => {
    if (kind === 'settings error') state.error = { message: 'private detail' }; else state.notice = null
    await expect(getEnrollmentPrivacyNotice(campaign)).rejects.toThrow('Assessment privacy information is unavailable.')
  })
  it('rejects invalid campaign identifiers before opening a privileged client', async () => {
    await expect(getEnrollmentPrivacyNotice('invalid')).rejects.toThrow()
    expect(state.open).not.toHaveBeenCalled()
  })
  it('keeps participants registered before activation outside the new acknowledgement flow', async () => {
    state.participant = { created_at: '2019-01-01T00:00:00Z' }
    expect(await getParticipantPrivacyState('33333333-3333-4333-8333-333333333333', campaign)).toBeNull()
    expect(state.from).not.toHaveBeenCalledWith('privacy_notice_versions')
    expect(state.from).not.toHaveBeenCalledWith('participant_privacy_receipts')
  })
  it('requires the short page for a platform-registered participant created after activation', async () => {
    expect(await getParticipantPrivacyState('33333333-3333-4333-8333-333333333333', campaign)).toMatchObject({ acknowledged: false, notice: { id: noticeId } })
  })
  it('skips another acknowledgement after the exact notice receipt is saved', async () => {
    state.receipts = [{ id: 'synthetic-receipt' }]
    expect(await getParticipantPrivacyState('33333333-3333-4333-8333-333333333333', campaign)).toMatchObject({ acknowledged: true })
  })
})
