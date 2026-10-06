import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultWorkspaceFeatures, featureForWorkspacePath } from '@/lib/features/workspace-features'

const state = vi.hoisted(() => ({ features: {} as Record<string, unknown>, client: vi.fn(), directoryClient: vi.fn(), integration: vi.fn(), backlog: vi.fn() }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/resolve-partner-org', () => ({ resolvePartnerOrg: async () => ({ partnerId: 'owning-partner' }) }))
vi.mock('@/lib/auth/resolve-partner-client', () => ({ requirePartnerClient: state.directoryClient }))
vi.mock('@/lib/dal/partner-integration-clients', () => ({ getPartnerIntegrationClient: state.client }))
vi.mock('@/app/actions/integrations', () => ({ getClientInternalIntegrationSettings: state.integration }))
vi.mock('@/lib/dal/webhook-backlog', () => ({ getWebhookBacklogReview: state.backlog }))
vi.mock('@/components/page-header', () => ({ PageHeader: () => <header>Client integrations</header> }))
vi.mock('@/app/(dashboard)/clients/[slug]/client-detail-shell', () => ({ ClientDetailShell: () => <div>Directory tabs</div> }))
vi.mock('@/app/(dashboard)/clients/[slug]/settings/client-integrations-panel', () => ({ ClientIntegrationsPanel: ({ clientId }: { clientId: string }) => <div>Connections {clientId}</div> }))
vi.mock('@/components/webhook-backlog-review', () => ({ WebhookBacklogReviewPanel: ({ clientId }: { clientId: string }) => <div>Backlog {clientId}</div> }))
import IntegrationLayout from '@/app/partner/integrations/layout'
import IntegrationClientPage from '@/app/partner/integrations/[slug]/page'
import DirectoryLayout from '@/app/partner/clients/[slug]/layout'

beforeEach(() => {
  vi.clearAllMocks()
  state.features = { ...defaultWorkspaceFeatures('partner'), clientDirectory: false, clientManagement: false }
  state.client.mockResolvedValue({ id: 'scoped-client', name: 'Synthetic client', slug: 'synthetic' })
  state.integration.mockResolvedValue({ canManage: true })
  state.backlog.mockResolvedValue({ deliveryEnabled: false, hasMore: false, events: [] })
})

describe('independent integration route and its actual ancestor layout', () => {
  it('reaches existing manager controls while client directory and metadata are disabled', async () => {
    const detail = await IntegrationClientPage({ params: Promise.resolve({ slug: 'synthetic' }) })
    const html = renderToStaticMarkup(await IntegrationLayout({ children: detail }))
    expect(html).toContain('Connections scoped-client')
    expect(html).toContain('Backlog scoped-client')
    expect(state.client).toHaveBeenCalledWith('owning-partner', 'synthetic')
    expect(state.directoryClient).not.toHaveBeenCalled()
    expect(featureForWorkspacePath('/partner/integrations/synthetic')).toBe('integrationManagement')
  })
  it('does not globally open the existing client tabs or their ancestor', async () => {
    const html = renderToStaticMarkup(await DirectoryLayout({ children: <div>Directory content</div>, params: Promise.resolve({ slug: 'synthetic' }) }))
    expect(html).toContain('Client directory is not enabled')
    expect(html).not.toContain('Directory content')
    expect(state.directoryClient).not.toHaveBeenCalled()
  })
  it('keeps the independent ancestor closed when integration management is unavailable', async () => {
    state.features.integrationManagement = false
    const html = renderToStaticMarkup(await IntegrationLayout({ children: <div>Private integration content</div> }))
    expect(html).toContain('Connection management is not enabled')
    expect(html).not.toContain('Private integration content')
  })
  it('denies a non-manager before reading any backlog', async () => {
    state.integration.mockResolvedValue({ canManage: false })
    await expect(IntegrationClientPage({ params: Promise.resolve({ slug: 'synthetic' }) })).rejects.toThrow('inaccessible')
    expect(state.backlog).not.toHaveBeenCalled()
  })
})
