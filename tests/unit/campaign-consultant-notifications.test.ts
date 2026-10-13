import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ settings: vi.fn(), update: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/features/access', () => ({ requireWorkspaceFeature: vi.fn(), isWorkspaceFeatureEnabled: vi.fn() }))
vi.mock('@/lib/auth/authorization', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth/authorization')>(),
  requireCampaignManage: async () => ({ scope: {}, clientId: 'client', partnerId: null }),
  canManageCampaign: () => true,
}))
vi.mock('@/lib/dal/campaigns', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/dal/campaigns')>(),
  getCampaignConsultantSettings: mocks.settings,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({
  from: () => ({ update: (patch: unknown) => {
    mocks.update(patch)
    return { eq: async () => ({ error: null }) }
  } }),
}) }))
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate, revalidateTag: vi.fn() }))

import { updateCampaignConsultantSettings } from '@/app/actions/campaigns'

beforeEach(() => {
  mocks.settings.mockResolvedValue({ enabled: true, emails: ['consultant@example.com'], includeSummary: true, attachPdf: true })
})

describe('consultant notification recipient validation', () => {
  it('rejects enabling an existing empty recipient list before writing', async () => {
    mocks.settings.mockResolvedValue({ enabled: false, emails: [] })
    expect(await updateCampaignConsultantSettings('campaign', { enabled: true })).toHaveProperty('error')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('rejects removing the last recipient from enabled notifications', async () => {
    expect(await updateCampaignConsultantSettings('campaign', { emails: ['  '] })).toHaveProperty('error')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('allows empty recipients when notifications are explicitly disabled', async () => {
    expect(await updateCampaignConsultantSettings('campaign', { enabled: false, emails: [] })).toEqual({ success: true })
    expect(mocks.update).toHaveBeenCalledWith({ consultant_notification_enabled: false, consultant_emails: [] })
  })
  it('allows setting recipients and enabling in the same update', async () => {
    mocks.settings.mockResolvedValue({ enabled: false, emails: [] })
    expect(await updateCampaignConsultantSettings('campaign', { enabled: true, emails: [' Consultant@Example.com ', 'consultant@example.com'] })).toEqual({ success: true })
    expect(mocks.update).toHaveBeenCalledWith({ consultant_notification_enabled: true, consultant_emails: ['consultant@example.com'] })
  })
  it('retains existing recipients when enabling', async () => {
    expect(await updateCampaignConsultantSettings('campaign', { enabled: true })).toEqual({ success: true })
    expect(mocks.update).toHaveBeenCalledWith({ consultant_notification_enabled: true })
  })
  it('fails safely when current settings cannot be read', async () => {
    mocks.settings.mockResolvedValue(null)
    expect(await updateCampaignConsultantSettings('campaign', { enabled: true })).toHaveProperty('error')
    expect(mocks.update).not.toHaveBeenCalled()
  })
  it('allows unrelated edits to legacy campaigns with no recipients', async () => {
    mocks.settings.mockResolvedValue({ enabled: true, emails: [] })
    expect(await updateCampaignConsultantSettings('campaign', { attachPdf: false })).toEqual({ success: true })
    expect(mocks.settings).not.toHaveBeenCalled()
  })
})
