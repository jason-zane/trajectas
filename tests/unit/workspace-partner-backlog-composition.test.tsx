import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'

const state = vi.hoisted(() => ({ features: {} as Record<string, unknown>, client: vi.fn(), integration: vi.fn(), backlog: vi.fn() }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/resolve-partner-client', () => ({ requirePartnerClient: state.client }))
vi.mock('@/app/actions/integrations', () => ({ getClientInternalIntegrationSettings: state.integration }))
vi.mock('@/app/actions/partner-entitlements', () => ({ getPartnerBrandingEnabled: async () => true }))
vi.mock('@/lib/dal/webhook-backlog', () => ({ getWebhookBacklogReview: state.backlog }))
vi.mock('@/app/(dashboard)/clients/[slug]/settings/client-settings-panel', () => ({ ClientSettingsPanel: ({ canManageMetadata }: { canManageMetadata: boolean }) => <div>{canManageMetadata ? 'Client metadata controls' : 'Integration controls only'}</div> }))
vi.mock('@/components/webhook-backlog-review', () => ({ WebhookBacklogReviewPanel: ({ clientId }: { clientId: string }) => <div>Review backlog {clientId}</div> }))
import PartnerClientSettingsPage from '@/app/partner/clients/[slug]/settings/page'

beforeEach(() => {
  vi.clearAllMocks()
  state.features = defaultWorkspaceFeatures('partner')
  state.client.mockResolvedValue({ client: { id: 'scoped-client' }, partnerId: 'owning-partner' })
  state.integration.mockResolvedValue({ canManage: true })
  state.backlog.mockResolvedValue({ deliveryEnabled: false, hasMore: false, events: [] })
})

describe('actual partner client settings exposes only the existing manager backlog', () => {
  it('permits existing managers to inspect paused events in their resolved client', async () => {
    const html = renderToStaticMarkup(await PartnerClientSettingsPage({ params: Promise.resolve({ slug: 'scoped' }) }))
    expect(html).toContain('Review backlog scoped-client')
    expect(state.client).toHaveBeenCalledWith('scoped')
    expect(state.backlog).toHaveBeenCalledExactlyOnceWith('scoped-client')
  })
  it('keeps integration/backlog inspection while client metadata editing is disabled', async () => {
    state.features.clientManagement = false
    const html = renderToStaticMarkup(await PartnerClientSettingsPage({ params: Promise.resolve({ slug: 'scoped' }) }))
    expect(html).toContain('Review backlog scoped-client')
    expect(html).toContain('Integration controls only')
    expect(html).not.toContain('Client metadata controls')
  })
  it('does not read or render backlog for a non-manager', async () => {
    state.integration.mockResolvedValue({ canManage: false })
    const html = renderToStaticMarkup(await PartnerClientSettingsPage({ params: Promise.resolve({ slug: 'scoped' }) }))
    expect(html).not.toContain('Review backlog')
    expect(state.backlog).not.toHaveBeenCalled()
  })
  it('avoids integration and backlog reads when connection management is unavailable', async () => {
    state.features.integrationManagement = false
    await PartnerClientSettingsPage({ params: Promise.resolve({ slug: 'scoped' }) })
    expect(state.integration).not.toHaveBeenCalled()
    expect(state.backlog).not.toHaveBeenCalled()
  })
  it('preserves denied partner/client resolution without opening a backlog', async () => {
    state.client.mockRejectedValue(new Error('Membership denied'))
    await expect(PartnerClientSettingsPage({ params: Promise.resolve({ slug: 'foreign' }) })).rejects.toThrow('Membership denied')
    expect(state.backlog).not.toHaveBeenCalled()
  })
})
