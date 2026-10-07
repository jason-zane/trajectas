import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactNode } from 'react'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'

const state = vi.hoisted(() => ({ features: {} as Record<string, unknown>, campaigns: vi.fn(), assessments: vi.fn(), clients: vi.fn(), actor: vi.fn() }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/app/actions/campaigns', () => ({ getCampaigns: state.campaigns, getActiveAssessments: state.assessments }))
vi.mock('@/app/actions/clients', () => ({ getClients: state.clients }))
vi.mock('@/lib/auth/actor', () => ({ resolveSessionActor: state.actor }))
vi.mock('@/components/page-header', () => ({ PageHeader: ({ children }: { children: ReactNode }) => <header>{children}</header> }))
vi.mock('@/components/campaigns/quick-launch-button', () => ({ QuickLaunchButton: ({ allowLeadership360 }: { allowLeadership360: boolean }) => <button>Quick launch {allowLeadership360 ? '360' : 'standard'}</button> }))
vi.mock('@/app/(dashboard)/campaigns/campaigns-table', () => ({ CampaignsTable: ({ campaigns }: { campaigns: { title: string }[] }) => <div>{campaigns.map(c => c.title).join(',')}</div> }))
import CampaignsPage from '@/app/(dashboard)/campaigns/page'

beforeEach(() => {
  vi.clearAllMocks()
  state.features = defaultWorkspaceFeatures('partner')
  state.campaigns.mockResolvedValue([{ title: 'Historical campaign' }])
  state.assessments.mockImplementation(async () => { if (!state.features.assessmentDelivery) throw new Error('Delivery unavailable'); return [] })
  state.clients.mockImplementation(async () => { if (!state.features.clientDirectory) throw new Error('Directory unavailable'); return [] })
  state.actor.mockResolvedValue({ email: 'synthetic@test.local' })
})

describe('actual admin campaign page composes selected/support workspace capabilities', () => {
  it.each(['assessmentDelivery', 'clientDirectory', 'campaignManagement'])('retains history and avoids launch queries when %s is unavailable', async feature => {
    state.features[feature] = false
    const html = renderToStaticMarkup(await CampaignsPage())
    expect(html).toContain('Historical campaign')
    expect(html).not.toContain('Quick launch')
    expect(html).not.toContain('New Campaign')
    expect(state.campaigns).toHaveBeenCalledOnce()
    expect(state.assessments).not.toHaveBeenCalled()
    expect(state.clients).not.toHaveBeenCalled()
    expect(state.actor).not.toHaveBeenCalled()
  })
  it('preserves the legacy launch controls and keeps specialist selection independently gated', async () => {
    state.features.feedback360 = false
    const html = renderToStaticMarkup(await CampaignsPage())
    expect(html).toContain('Historical campaign')
    expect(html).toContain('New Campaign')
    expect(html).toContain('Quick launch standard')
    expect(state.assessments).toHaveBeenCalledOnce()
    expect(state.clients).toHaveBeenCalledOnce()
  })
  it('does not read history or launch data when campaign viewing is unavailable', async () => {
    state.features.campaignViewing = false
    await CampaignsPage()
    expect(state.campaigns).not.toHaveBeenCalled()
    expect(state.assessments).not.toHaveBeenCalled()
    expect(state.clients).not.toHaveBeenCalled()
  })
})
