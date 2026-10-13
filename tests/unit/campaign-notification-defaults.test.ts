import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'

const mocks = vi.hoisted(() => ({
  scope: vi.fn(), manage: vi.fn(), insert: vi.fn(),
  source: {} as Record<string, unknown>,
}))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: vi.fn(), isWorkspaceFeatureEnabled: vi.fn() }))
vi.mock('@/lib/features/integration-access', () => ({ requireIntegrationClientFeature: vi.fn() }))
vi.mock('@/lib/auth/authorization', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth/authorization')>(),
  resolveAuthorizedScope: mocks.scope, requireCampaignManage: mocks.manage,
}))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: (table: string) => {
    let inserted: Record<string, unknown> | null = null
    const query: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'is', 'in', 'single', 'order']) query[method] = () => query
    query.insert = (row: Record<string, unknown>) => { inserted = row; mocks.insert(table, row); return query }
    query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({
      error: null,
      data: table === 'clients' ? { id: '11111111-1111-4111-8111-111111111111', partner_id: null }
        : table === 'campaigns' ? inserted ? { id: 'new-campaign', ...inserted } : mocks.source
        : [],
    }).then(resolve)
    return query
  },
}) }))

import { createCampaign, duplicateCampaignForReuse } from '@/app/actions/campaigns'
import { createIntegrationCampaign } from '@/lib/integrations/service'
import { PUBLIC_BUILDS_SYSTEM_SCOPE, PUBLIC_BUILDS_CLIENT_ID } from '@/lib/public-builds/constants'

function scope(email: string | null = 'creator@example.com'): AuthorizedScope {
  return {
    actor: email ? { email } as AuthorizedScope['actor'] : null,
    activeContext: null, previewContext: null, requestSurface: 'client', isPlatformAdmin: false,
    isLocalDevelopmentBypass: false, isLocalDevelopment: false, partnerIds: [], partnerAdminIds: [],
    clientIds: ['11111111-1111-4111-8111-111111111111'], clientAdminIds: ['11111111-1111-4111-8111-111111111111'], managedClientIds: ['11111111-1111-4111-8111-111111111111'], supportSession: null,
  }
}
beforeEach(() => {
  mocks.scope.mockResolvedValue(scope())
  mocks.manage.mockResolvedValue({ scope: scope(), clientId: '11111111-1111-4111-8111-111111111111', partnerId: null })
  mocks.source = { id: 'source', title: 'Leadership', client_id: '11111111-1111-4111-8111-111111111111', consultant_emails: [], consultant_notification_enabled: true }
})
const campaignInsert = () => mocks.insert.mock.calls.find(([table]) => table === 'campaigns')?.[1]

describe('notification policy across campaign creation paths', () => {
  it('starts staff-created campaigns with their creator as recipient', async () => {
    expect(await createCampaign({ title: 'Leadership', slug: 'leadership', clientId: '11111111-1111-4111-8111-111111111111' })).toHaveProperty('success', true)
    expect(campaignInsert()).toMatchObject({ consultant_emails: ['creator@example.com'], consultant_notification_enabled: true })
  })
  it('does not enable consultant emails for public Role Builder system campaigns', async () => {
    expect(await createCampaign({ title: 'Leadership', slug: 'leadership', clientId: PUBLIC_BUILDS_CLIENT_ID }, { systemScope: PUBLIC_BUILDS_SYSTEM_SCOPE })).toHaveProperty('success', true)
    expect(campaignInsert()).toMatchObject({ consultant_emails: [], consultant_notification_enabled: false })
  })
  it('does not enable consultant emails for API-created campaigns without configured staff recipients', async () => {
    await createIntegrationCampaign({ requestId: 'request', clientId: '11111111-1111-4111-8111-111111111111', connectionId: 'connection', connectionProvider: 'custom', credentialId: 'credential', credentialLabel: 'API', scopes: ['campaigns:write'] }, {
      title: 'Leadership', slug: 'leadership', status: 'draft', allowResume: true, showProgress: true, randomizeAssessmentOrder: false,
    })
    expect(campaignInsert()).toMatchObject({ consultant_emails: [], consultant_notification_enabled: false })
  })
  it('preserves the recipients and content options selected on the reused campaign', async () => {
    mocks.source.consultant_emails = ['selected@example.com']
    mocks.source.consultant_notification_include_summary = false
    mocks.source.consultant_notification_attach_pdf = false
    expect(await duplicateCampaignForReuse('source')).toHaveProperty('success', true)
    expect(campaignInsert()).toMatchObject({ consultant_emails: ['selected@example.com'], consultant_notification_enabled: true, consultant_notification_include_summary: false, consultant_notification_attach_pdf: false })
  })
  it('seeds an enabled legacy empty campaign copy with the authorized copier email', async () => {
    expect(await duplicateCampaignForReuse('source')).toHaveProperty('success', true)
    expect(campaignInsert()).toMatchObject({ consultant_emails: ['creator@example.com'], consultant_notification_enabled: true })
  })
  it.each([{ emails: [] }, { emails: ['selected@example.com'] }])('preserves explicitly disabled notifications when reusing recipients $emails', async ({ emails }) => {
    mocks.source.consultant_notification_enabled = false
    mocks.source.consultant_emails = emails
    expect(await duplicateCampaignForReuse('source')).toHaveProperty('success', true)
    expect(campaignInsert()).toMatchObject({ consultant_emails: emails, consultant_notification_enabled: false })
  })
  it('keeps a recipient-less copy disabled when no staff actor email exists', async () => {
    mocks.manage.mockResolvedValue({ scope: scope(null), clientId: '11111111-1111-4111-8111-111111111111', partnerId: null })
    expect(await duplicateCampaignForReuse('source')).toHaveProperty('success', true)
    expect(campaignInsert()).toMatchObject({ consultant_emails: [], consultant_notification_enabled: false })
  })
})
