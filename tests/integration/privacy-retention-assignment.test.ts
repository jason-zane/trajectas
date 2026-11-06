import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'
const state = vi.hoisted(() => ({ actor: '' }))
vi.mock('@/lib/supabase/admin', async () => ({ createAdminClient: (await import('./_helpers/rls-fixture')).createAdminClient }))
vi.mock('@/lib/auth/authorization', async original => ({
  ...await original<typeof import('@/lib/auth/authorization')>(),
  resolveAuthorizedScope: async (): Promise<AuthorizedScope> => ({ actor: { id: state.actor, email: 'synthetic-retention@example.invalid', role: 'platform_admin', isActive: true, partnerMemberships: [], clientMemberships: [], activeContext: null }, activeContext: null, previewContext: null, requestSurface: 'admin', isPlatformAdmin: true, isLocalDevelopmentBypass: false, partnerIds: [], partnerAdminIds: [], clientIds: [], clientAdminIds: [], managedClientIds: [], isLocalDevelopment: false, supportSession: null }),
}))
import { setCampaignPrivacy } from '@/lib/dal/privacy'

describe.skipIf(!canRun)('retention assignment with real privacy constraints', () => {
  const db = createAdminClient(), campaignId = randomUUID(), policyId = randomUUID(), noticeId = randomUUID(), draftId = randomUUID()
  const effective = '2026-01-01T00:00:00+00:00', closure = '2026-02-01T00:00:00+00:00'
  beforeAll(async () => {
    if (!canRun) return
    state.actor = (await createTestUser(db, { email: `retention-${randomUUID()}@example.invalid`, role: 'platform_admin' })).userId
    async function insert(table: string, row: unknown) { expect((await db.from(table).insert(row)).error, table).toBeNull() }
    await insert('campaigns', { id: campaignId, title: 'Synthetic retention-only fixture', slug: 'retention-' + campaignId, status: 'active' })
    await insert('privacy_retention_policies', { id: policyId, name: 'Synthetic retention fixture', version: policyId, retention_months: 12, backup_days: 7, status: 'active', approved_at: new Date().toISOString(), approved_by: state.actor })
    await insert('privacy_notice_versions', { id: noticeId, version: noticeId, title: 'Synthetic notice', body: 'Synthetic privacy information.', status: 'published', published_at: new Date().toISOString(), published_by: state.actor })
    await insert('privacy_notice_versions', { id: draftId, version: draftId, title: 'Synthetic draft', body: 'Unpublished synthetic privacy information.' })
  })
  it('assigns retention without creating or assigning a participant notice', async () => {
    await setCampaignPrivacy({ campaignId, policyId, closedAt: null })
    const { data, error } = await db.from('campaign_privacy_settings').select('retention_policy_id,notice_version_id,closed_at').eq('campaign_id', campaignId).single()
    expect(error).toBeNull(); expect(data).toEqual({ retention_policy_id: policyId, notice_version_id: null, closed_at: null })
  })
  it('preserves an existing notice boundary and closure on a retention-only update', async () => {
    expect((await db.from('campaign_privacy_settings').update({ notice_version_id: noticeId, notice_effective_at: effective, closed_at: closure }).eq('campaign_id', campaignId)).error).toBeNull()
    await setCampaignPrivacy({ campaignId, policyId, closedAt: null })
    const { data, error } = await db.from('campaign_privacy_settings').select('notice_version_id,notice_effective_at,closed_at').eq('campaign_id', campaignId).single()
    expect(error).toBeNull(); expect(data?.notice_version_id).toBe(noticeId)
    expect(Date.parse(data!.notice_effective_at)).toBe(Date.parse(effective)); expect(Date.parse(data!.closed_at)).toBe(Date.parse(closure))
  })
  it('rejects an unpublished replacement and leaves the prior notice unchanged', async () => {
    await expect(setCampaignPrivacy({ campaignId, policyId, noticeId: draftId, closedAt: null })).rejects.toThrow('The privacy operation could not be completed.')
    const { data } = await db.from('campaign_privacy_settings').select('notice_version_id').eq('campaign_id', campaignId).single()
    expect(data?.notice_version_id).toBe(noticeId)
  })
})
