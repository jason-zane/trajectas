import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
const state = vi.hoisted(() => ({ features: {} as Record<string, unknown>, access: vi.fn(), queries: [] as { table: string; filters: [string,unknown][] }[] }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: async () => state.features }))
vi.mock('@/lib/auth/authorization', async original => ({ ...await original<typeof import('@/lib/auth/authorization')>(), requireClientAccess: state.access }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (table: string) => {
  const item = { table, filters: [] as [string,unknown][] }; state.queries.push(item)
  const query: Record<string, unknown> = {}
  query.select = () => query; query.is = () => query
  query.eq = (key: string, value: unknown) => { item.filters.push([key,value]); return query }
  query.in = (key: string, value: unknown) => { item.filters.push([key,value]); return query }
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: table === 'campaigns' ? [{ id: 'synthetic-campaign' }] : [], count: 2, error: null }).then(resolve)
  return query
} }) }))
import { getClientStats } from '@/app/actions/clients'
beforeEach(() => { state.features = defaultWorkspaceFeatures('partner'); state.queries=[]; state.access.mockReset().mockResolvedValue(undefined) })
describe('client overview composes enabled modules with existing client access', () => {
  it('keeps campaign history and report counters when new delivery is disabled', async () => {
    state.features.assessmentDelivery = false
    expect(await getClientStats('synthetic-client')).toEqual({ activeCampaignCount: 2, totalParticipants: 2, assignedAssessmentCount: 2, reportsGenerated: 2 })
    expect(state.access).toHaveBeenCalledWith('synthetic-client')
    for (const query of state.queries.filter(item => item.table !== 'campaign_participants')) expect(query.filters).toContainEqual(['client_id','synthetic-client'])
    expect(state.queries.find(item => item.table === 'campaign_participants')?.filters).toEqual([['campaign_id',['synthetic-campaign']]])
  })
  it('avoids disabled module queries while retaining the allowed assessment summary', async () => {
    state.features.campaignViewing=false; state.features.orgDiagnostics=false
    expect(await getClientStats('synthetic-client')).toEqual({ activeCampaignCount: 0, totalParticipants: 0, assignedAssessmentCount: 2, reportsGenerated: 0 })
    expect(state.queries.map(item => item.table)).toEqual(['client_assessment_assignments'])
  })
  it('denies unauthorized client access before any summary query', async () => {
    state.access.mockRejectedValue(new Error('Client not accessible'))
    await expect(getClientStats('unrelated-client')).rejects.toThrow('Client not accessible')
    expect(state.queries).toEqual([])
  })
})
