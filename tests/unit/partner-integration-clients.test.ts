import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'

const state = vi.hoisted(() => ({ features: {} as Record<string, unknown>, access: vi.fn(), rows: [] as { id: string; name: string; slug: string }[], queries: [] as { filters: unknown[][]; range?: number[]; select?: string }[], managed: [] as string[] }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/authorization', async original => ({
  ...await original<typeof import('@/lib/auth/authorization')>(),
  requirePartnerAccess: state.access,
  resolveAuthorizedScope: async () => ({ requestSurface: 'partner', isPlatformAdmin: false, activeContext: null }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ from: () => {
  const query = { filters: [] as unknown[][], select: '', range: undefined as number[] | undefined }
  state.queries.push(query)
  const chain = {
    select: (value: string) => { query.select = value; return chain },
    eq: (...values: unknown[]) => { query.filters.push(['eq', ...values]); return chain },
    in: (...values: unknown[]) => { query.filters.push(['in', ...values]); return chain },
    is: (...values: unknown[]) => { query.filters.push(['is', ...values]); return chain },
    order: () => chain,
    range: (...values: number[]) => { query.range = values; return chain },
    maybeSingle: async () => ({ data: state.rows[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: state.rows, error: null }).then(resolve),
  }
  return chain
} }) }))
import { getPartnerIntegrationClient, listPartnerIntegrationClients } from '@/lib/dal/partner-integration-clients'
import { toggleClientBranding } from '@/app/actions/client-entitlements'
const partner = '11111111-1111-4111-8111-111111111111'
const client = '22222222-2222-4222-8222-222222222222'

beforeEach(() => {
  vi.clearAllMocks()
  state.features = { ...defaultWorkspaceFeatures('partner'), clientDirectory: false, clientManagement: false }
  state.queries = []
  state.managed = [client]
  state.rows = [{ id: client, name: 'Synthetic client', slug: 'synthetic' }]
  state.access.mockImplementation(async () => ({ partnerId: partner, scope: { requestSurface: 'partner', isPlatformAdmin: false, managedClientIds: state.managed } }))
})

describe('integration selectors retain existing manager scope independently of client metadata', () => {
  it('returns only minimal client identity with both ownership and managed-set predicates', async () => {
    expect(await listPartnerIntegrationClients(partner)).toEqual({ clients: state.rows, hasMore: false })
    expect(state.access).toHaveBeenCalledWith(partner)
    expect(state.queries[0]).toMatchObject({ select: 'id,name,slug', range: [0, 100] })
    expect(state.queries[0].filters).toContainEqual(['eq', 'partner_id', partner])
    expect(state.queries[0].filters).toContainEqual(['in', 'id', [client]])
    expect(await getPartnerIntegrationClient(partner, 'synthetic')).toEqual(state.rows[0])
    expect(state.queries[1].filters).toContainEqual(['eq', 'slug', 'synthetic'])
  })
  it('bounds pages and indicates further manageable clients', async () => {
    state.rows = Array.from({ length: 101 }, (_, i) => ({ id: String(i), name: 'Synthetic', slug: `synthetic-${i}` }))
    const result = await listPartnerIntegrationClients(partner, 1)
    expect(result.clients).toHaveLength(100)
    expect(result.hasMore).toBe(true)
    expect(state.queries[0].range).toEqual([100, 200])
    await expect(listPartnerIntegrationClients(partner, -1)).rejects.toThrow()
  })
  it('does not query a client for ordinary members or an inaccessible partner', async () => {
    state.managed = []
    expect(await listPartnerIntegrationClients(partner)).toEqual({ clients: [], hasMore: false })
    await expect(getPartnerIntegrationClient(partner, 'synthetic')).rejects.toThrow('inaccessible')
    expect(state.queries).toEqual([])
    state.access.mockRejectedValue(new Error('Partner denied'))
    await expect(listPartnerIntegrationClients(partner)).rejects.toThrow('Partner denied')
    expect(state.queries).toEqual([])
  })
  it('keeps detail role verification even if a returned identity is outside the managed set', async () => {
    state.rows[0].id = 'foreign'
    await expect(getPartnerIntegrationClient(partner, 'synthetic')).rejects.toThrow('inaccessible')
  })
  it('denies integration reads and client metadata mutations under their independent flags', async () => {
    await expect(toggleClientBranding(client, true)).rejects.toThrow('not enabled')
    expect(state.queries).toEqual([])
    state.features.integrationManagement = false
    await expect(listPartnerIntegrationClients(partner)).rejects.toThrow('not enabled')
    expect(state.access).not.toHaveBeenCalled()
    expect(state.queries).toEqual([])
  })
})
