import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ access: vi.fn(), currentMode: 'aggregate_only', refreshError: false,
  order: [] as string[], audit: vi.fn() }))
vi.mock('@/lib/auth/authorization', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth/authorization')>(), requireCampaignManage: mocks.access,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: (table: string) => {
  mocks.order.push(table)
  const query = { insert: () => query, select: () => query, eq: () => query,
    single: async () => ({ data: { id: 'participant', access_token: 'PRIVATE_TOKEN' }, error: null }),
    maybeSingle: async () => ({ data: mocks.refreshError ? null : { confidentiality_mode: mocks.currentMode },
      error: mocks.refreshError ? new Error('Refresh failed') : null }),
  }
  return query
} }) }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: mocks.audit }))
vi.mock('@/lib/security/action-errors', () => ({ logActionError: vi.fn(), throwActionError: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

import { inviteParticipant } from '@/app/actions/campaigns'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.order.length = 0
  mocks.currentMode = 'aggregate_only'
  mocks.refreshError = false
  mocks.access.mockResolvedValue({ clientId: null, partnerId: null, confidentialityMode: 'standard',
    scope: { actor: { id: 'actor' }, isPlatformAdmin: false } })
})
describe('invite response uses the enrollment confidentiality mode', () => {
  it('withholds a token when the mode changed after authorization but before insertion', async () => {
    const result = await inviteParticipant('campaign', { email: 'person@example.invalid' }, { deferEmail: true })
    expect(result).toMatchObject({ success: true, accessToken: '' })
    expect(mocks.order).toEqual(['campaign_participants', 'campaigns'])
  })
  it('retains link sharing when the current mode is standard', async () => {
    mocks.currentMode = 'standard'
    const result = await inviteParticipant('campaign', { email: 'person@example.invalid' }, { deferEmail: true })
    expect(result).toMatchObject({ success: true, accessToken: 'PRIVATE_TOKEN' })
  })
  it('withholds the token if the current mode cannot be read', async () => {
    mocks.refreshError = true
    const result = await inviteParticipant('campaign', { email: 'person@example.invalid' }, { deferEmail: true })
    expect(result).toMatchObject({ success: true, accessToken: '' })
  })
})
