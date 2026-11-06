import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'
const state = vi.hoisted(() => ({ resolve: vi.fn(), open: vi.fn(), upsert: vi.fn(), update: vi.fn(), filters: vi.fn(), tables: vi.fn(), current: null as unknown, policy: { id: 'policy' } as unknown, notice: { id: 'notice' } as unknown, error: null as unknown, writeError: null as unknown, writeData: { campaign_id: 'campaign' } as unknown }))
vi.mock('@/lib/auth/authorization', async original => ({ ...await original<typeof import('@/lib/auth/authorization')>(), resolveAuthorizedScope: state.resolve }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => {
  state.open()
  return { from: (table: string) => {
    state.tables(table)
    const q: Record<string, unknown> = {}
    let writing = false
    q.select = () => q
    q.eq = q.is = (column: string, value: unknown) => { state.filters(table, column, value); return q }
    const result = () => writing ? { data: state.writeData, error: state.writeError } : { data: table === 'privacy_retention_policies' ? state.policy : table === 'privacy_notice_versions' ? state.notice : state.current, error: state.error }
    q.single = q.maybeSingle = async () => result()
    q.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve)
    q.upsert = async (value: unknown, options: unknown) => { state.upsert(value, options); return { error: state.writeError } }
    q.update = (value: unknown) => { writing = true; state.update(value); return q }
    return q
  } }
} }))
import { setCampaignPrivacy } from '@/lib/dal/privacy'
import { campaignPrivacyInput } from '@/lib/privacy/inputs'
const actorId = '11111111-1111-4111-8111-111111111111', campaignId = '22222222-2222-4222-8222-222222222222', policyId = '33333333-3333-4333-8333-333333333333', noticeId = '44444444-4444-4444-8444-444444444444'
const input = { campaignId, policyId, closedAt: null }
function scope(): AuthorizedScope {
  return { actor: { id: actorId, email: 'synthetic@example.invalid', role: 'platform_admin', isActive: true, partnerMemberships: [], clientMemberships: [], activeContext: null }, activeContext: null, previewContext: null, requestSurface: 'admin', isPlatformAdmin: true, isLocalDevelopmentBypass: false, partnerIds: [], partnerAdminIds: [], clientIds: [], clientAdminIds: [], managedClientIds: [], isLocalDevelopment: false, supportSession: null }
}
beforeEach(() => { state.resolve.mockResolvedValue(scope()); state.current = null; state.policy = { id: policyId }; state.notice = { id: noticeId }; state.error = null; state.writeError = null; state.writeData = { campaign_id: campaignId } })
describe('retention without notice publication', () => {
  it('assigns an approved policy with no participant notice', async () => {
    await setCampaignPrivacy(input)
    expect(state.tables).not.toHaveBeenCalledWith('privacy_notice_versions')
    expect(state.upsert).toHaveBeenCalledWith(expect.objectContaining({ campaign_id: campaignId, retention_policy_id: policyId, closed_at: null, updated_by: actorId }), { onConflict: 'campaign_id', ignoreDuplicates: true })
    expect(state.update).toHaveBeenCalledWith(expect.objectContaining({ retention_policy_id: policyId, updated_by: actorId }))
    expect(state.filters).toHaveBeenCalledWith('privacy_retention_policies', 'status', 'active')
    expect(state.filters).toHaveBeenCalledWith('privacy_retention_policies', 'scope', 'assessment')
    expect(state.filters).toHaveBeenCalledWith('privacy_retention_policies', 'recovery_only', false)
  })
  it('preserves even a concurrently assigned notice and closure without writing stale values', async () => {
    state.current = { notice_version_id: noticeId, notice_effective_at: '2026-01-01T00:00:00Z', closed_at: '2026-02-01T00:00:00Z' }
    await setCampaignPrivacy({ ...input, closedAt: '2026-03-01T00:00:00Z' })
    expect(state.upsert).toHaveBeenCalledWith(expect.anything(), { onConflict: 'campaign_id', ignoreDuplicates: true })
    for (const [write] of [...state.upsert.mock.calls, ...state.update.mock.calls]) {
      expect(write).not.toHaveProperty('notice_version_id')
      expect(write).not.toHaveProperty('notice_effective_at')
    }
    expect(state.update).toHaveBeenLastCalledWith(expect.objectContaining({ closed_at: '2026-03-01T00:00:00Z' }))
    expect(state.filters).toHaveBeenCalledWith('campaign_privacy_settings', 'closed_at', null)
  })
  it('still requires a selected replacement to be a published participant notice', async () => {
    await setCampaignPrivacy({ ...input, noticeId })
    expect(state.filters).toHaveBeenCalledWith('privacy_notice_versions', 'id', noticeId)
    expect(state.filters).toHaveBeenCalledWith('privacy_notice_versions', 'status', 'published')
    expect(state.filters).toHaveBeenCalledWith('privacy_notice_versions', 'audience', 'participant')
    expect(state.upsert).toHaveBeenCalledWith(expect.objectContaining({ notice_version_id: noticeId }), { onConflict: 'campaign_id' })
  })
  it('does not reset the cutoff when the same published notice is selected again', async () => {
    state.current = { notice_version_id: noticeId, notice_effective_at: '2026-01-01T00:00:00Z', closed_at: null }
    await setCampaignPrivacy({ ...input, noticeId })
    expect(state.upsert).toHaveBeenCalledWith(expect.objectContaining({ notice_effective_at: '2026-01-01T00:00:00Z' }), { onConflict: 'campaign_id' })
  })
  it.each(['provider error', 'missing row'])('does not report success after an incomplete retention write (%s)', async kind => {
    if (kind === 'provider error') state.writeError = { message: 'private provider detail' }
    else state.writeData = null
    await expect(setCampaignPrivacy(input)).rejects.toThrow('The privacy operation could not be completed.')
  })
  it.each(['policy', 'notice', 'query error'])('fails closed for unavailable %s', async kind => {
    if (kind === 'policy') state.policy = null
    if (kind === 'notice') state.notice = null
    if (kind === 'query error') state.error = { message: 'private provider detail' }
    await expect(setCampaignPrivacy({ ...input, noticeId })).rejects.toThrow('The privacy operation could not be completed.')
    expect(state.upsert).not.toHaveBeenCalled()
  })
  it('rejects future closure dates before opening a privileged client', async () => {
    await expect(setCampaignPrivacy({ ...input, closedAt: '2999-01-01T00:00:00Z' })).rejects.toThrow('Choose an actual closure date.')
    expect(state.open).not.toHaveBeenCalled()
  })
  it('retains platform-only authority', async () => {
    state.resolve.mockResolvedValue({ ...scope(), isPlatformAdmin: false })
    await expect(setCampaignPrivacy(input)).rejects.toThrow('Use the platform workspace')
    expect(state.open).not.toHaveBeenCalled()
  })
  it.each(['', null, 'not-a-uuid'])('rejects an explicit invalid notice rather than treating it as an instruction to clear (%s)', value => {
    expect(campaignPrivacyInput.safeParse({ ...input, noticeId: value }).success).toBe(false)
  })
})
