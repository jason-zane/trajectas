import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'

const state = vi.hoisted(() => ({
  features: {} as Record<string, unknown>,
  rows: [] as { id: string; client_id: string; partner_id: string; kind: string }[],
  canManage: vi.fn(),
  writes: vi.fn(),
  reads: vi.fn(),
  readError: null as { message: string } | null,
}))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/authorization', async original => ({
  ...await original<typeof import('@/lib/auth/authorization')>(),
  resolveAuthorizedScope: async () => ({ actor: { id: 'manager' } }),
  canManageCampaign: state.canManage,
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  state.reads(table)
  let updating = false
  const chain = {
    select: () => chain,
    in: () => chain,
    is: () => chain,
    update: (values: unknown) => { updating = true; state.writes(values); return chain },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: updating ? null : state.rows, error: updating ? null : state.readError }).then(resolve),
  }
  return chain
} }) }))
import { bulkUpdateCampaignStatus } from '@/app/actions/campaigns'

beforeEach(() => {
  vi.clearAllMocks()
  state.features = defaultWorkspaceFeatures('partner')
  state.rows = [{ id: 'self', client_id: 'client', partner_id: 'partner', kind: 'self_report' }]
  state.canManage.mockReturnValue(true)
  state.readError = null
})

describe('bulk activation preserves delivery and specialist availability', () => {
  it('denies activation before a database read when delivery is disabled', async () => {
    state.features.assessmentDelivery = false
    await expect(bulkUpdateCampaignStatus(['self'], 'active')).rejects.toThrow('not enabled')
    expect(state.reads).not.toHaveBeenCalled()
    expect(state.writes).not.toHaveBeenCalled()
  })
  it('rejects the whole mixed batch when 360 delivery is unavailable', async () => {
    state.features.feedback360 = false
    state.rows.push({ id: '360', client_id: 'client', partner_id: 'partner', kind: 'leadership_360' })
    expect(await bulkUpdateCampaignStatus(['self', '360'], 'active')).toHaveProperty('error', '360 feedback is not enabled for your workspace.')
    expect(state.writes).not.toHaveBeenCalled()
  })
  it('allows ordinary activation with 360 disabled and specialist activation when enabled', async () => {
    state.features.feedback360 = false
    await bulkUpdateCampaignStatus(['self'], 'active')
    expect(state.writes).toHaveBeenCalledExactlyOnceWith({ status: 'active' })
    state.writes.mockClear()
    state.features.feedback360 = true
    state.rows[0].kind = 'leadership_360'
    await bulkUpdateCampaignStatus(['self'], 'active')
    expect(state.writes).toHaveBeenCalledExactlyOnceWith({ status: 'active' })
  })
  it('retains role denial even when both features are enabled', async () => {
    state.canManage.mockReturnValue(false)
    expect(await bulkUpdateCampaignStatus(['self'], 'active')).toHaveProperty('error', 'Not authorized to manage one or more campaigns.')
    expect(state.writes).not.toHaveBeenCalled()
  })
  it('keeps pause available while new delivery is disabled', async () => {
    state.features.assessmentDelivery = false
    await bulkUpdateCampaignStatus(['self'], 'paused')
    expect(state.writes).toHaveBeenCalledExactlyOnceWith({ status: 'paused' })
  })
  it('fails closed when campaign availability cannot be verified', async () => {
    state.features.feedback360 = false
    state.readError = { message: 'database unavailable' }
    expect(await bulkUpdateCampaignStatus(['self'], 'active')).toHaveProperty('error')
    expect(state.writes).not.toHaveBeenCalled()
  })
})
