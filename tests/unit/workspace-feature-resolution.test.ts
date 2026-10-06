import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'
import { defaultWorkspaceFeatures, previewFeatureChange } from '@/lib/features/workspace-features'
const state = vi.hoisted(() => ({ scope: {} as AuthorizedScope, rows: {} as Record<string, Record<string, unknown>>, calls: [] as { table: string; filters: [string, unknown][] }[], error: false, owner: '' as string | null, rpc: vi.fn(), history: [] as Record<string, unknown>[] }))
vi.mock('@/lib/auth/authorization', async original => ({ ...await original<typeof import('@/lib/auth/authorization')>(), resolveAuthorizedScope: async () => state.scope }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: state.rpc, from: (table: string) => {
  const call = { table, filters: [] as [string,unknown][] }; state.calls.push(call)
  const query: Record<string, unknown> = {}
  query.eq = (key: string, value: unknown) => { call.filters.push([key,value]); return query }
  query.in = (key: string, value: unknown) => { call.filters.push([key,value]); return query }
  for (const method of ['select','is','order','limit']) query[method] = () => query
  const result = () => ({ data: table === 'workspace_feature_settings' ? state.rows[String(call.filters[0]?.[1])] ?? null : table === 'audit_events' ? state.history : table === 'clients' && call.filters.some(([key]) => key === 'partner_id') ? { partner_id: state.owner } : { id: call.filters[0]?.[1] }, error: state.error ? { message: 'synthetic database unavailable' } : null })
  query.maybeSingle = async () => result(); query.single = async () => result()
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve)
  return query
} }) }))
import { getEffectiveWorkspaceFeatures, getTenantWorkspaceFeatures, setTenantWorkspaceFeature, applyWorkspaceFeatureConfiguration, getWorkspaceFeatureHistory } from '@/lib/dal/workspace-features'
const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222', client = '33333333-3333-4333-8333-333333333333', actor = '44444444-4444-4444-8444-444444444444'
function scope(overrides: Partial<AuthorizedScope> = {}): AuthorizedScope { return { actor: { id: actor, email: 'synthetic@test.local', role: 'platform_admin', isActive: true, partnerMemberships: [], clientMemberships: [], activeContext: null }, activeContext: null, previewContext: null, requestSurface: 'admin', isPlatformAdmin: true, isLocalDevelopmentBypass: false, isLocalDevelopment: false, supportSession: null, partnerIds: [], partnerAdminIds: [], clientIds: [], clientAdminIds: [], managedClientIds: [], ...overrides } }
function row(module_flags: Record<string, boolean> = {}, client_id: string | null = null) { return { compare_enabled: true, trajectory_enabled: true, unified_trajectory_enabled: !client_id, dashboard_style: 'default', module_flags, client_id } }
beforeEach(() => { state.scope=scope(); state.rows={}; state.calls=[]; state.error=false; state.owner=a; state.history=[]; state.rpc.mockReset() })
describe('module resolution preserves phase-one context and confinement', () => {
  it('keeps public and root requests without target context disabled even with memberships', async () => {
    for (const requestSurface of ['public', 'admin'] as const) {
      state.scope=scope({ requestSurface, isPlatformAdmin:false, clientIds:[client], clientAdminIds:[client], partnerIds:[a] })
      expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ campaignViewing:false, clientProvisioning:false })
    }
    expect(state.calls).toEqual([])
  })
  it('licenses a root org-admin’s explicit own-client context and preserves disabled overrides', async () => {
    state.scope=scope({ isPlatformAdmin:false, clientIds:[client], clientAdminIds:[client], partnerIds:[], activeContext:{ surface:'admin', tenantType:'client', tenantId:client } })
    state.scope.actor={ ...state.scope.actor!, role:'org_admin', clientMemberships:[{ id:'synthetic-membership',clientId:client,role:'admin',isDefault:true,createdAt:'2026-10-07T00:00:00Z' }] }
    state.rows[client]=row({ participantExperience:false },client)
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ campaignViewing:true, participantExperience:false, clientProvisioning:false, unifiedTrajectory:false })
    expect(state.calls).toEqual([{table:'workspace_feature_settings',filters:[['client_id',client]]}])
    state.calls=[]
    state.scope.activeContext={ surface:'admin',tenantType:'client',tenantId:b }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ campaignViewing:false, participantExperience:false })
    expect(state.calls).toEqual([])
    await expect(getTenantWorkspaceFeatures('client',b)).rejects.toThrow('not accessible')
  })
  it.each(['client','partner'] as const)('uses legacy defaults for missing %s rows and overlays only stored modules', async type => {
    const id=type==='client'?client:a
    expect(await getTenantWorkspaceFeatures(type,id)).toEqual(defaultWorkspaceFeatures(type))
    state.rows[id]=row({ reportGeneration: false, workspaceAssistant: false },type==='client'?client:null)
    expect(await getTenantWorkspaceFeatures(type,id)).toMatchObject({ reportGeneration:false, workspaceAssistant:false, campaignViewing:true, clientDirectory:type==='partner' })
  })
  it('intersects every module across memberships and narrows selected workspaces', async () => {
    state.rows[a]=row({ assessmentDelivery:false }); state.rows[b]=row({ usageVisibility:false })
    state.scope=scope({ requestSurface:'partner', isPlatformAdmin:false, partnerIds:[a,b] })
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ assessmentDelivery:false, usageVisibility:false })
    state.scope.activeContext={ surface:'partner', tenantType:'partner', tenantId:b }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ assessmentDelivery:true, usageVisibility:false })
  })
  it('uses a selected client’s owning partner and keeps client licensing independent', async () => {
    state.rows[a]=row({ assessmentDelivery:false }); state.rows[b]=row({ usageVisibility:false }); state.rows[client]={ ...row({ reportGeneration:false },client), unified_trajectory_enabled:true }
    state.scope=scope({ requestSurface:'partner', isPlatformAdmin:false, partnerIds:[a,b], clientIds:[client], activeContext:{ surface:'partner',tenantType:'client',tenantId:client } })
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ assessmentDelivery:false, reportGeneration:true, usageVisibility:true })
    expect(state.calls.find(call=>call.table==='clients')?.filters).toEqual([['id',client],['partner_id',[a,b]]])
    state.scope.requestSurface='client'
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ assessmentDelivery:true, reportGeneration:false, unifiedTrajectory:true, clientDirectory:false })
  })
  it('fails closed on unavailable DB, missing selected ownership and unauthorized tenant IDs', async () => {
    state.scope=scope({ requestSurface:'partner', isPlatformAdmin:false, partnerIds:[a], clientIds:[client], activeContext:{ surface:'partner',tenantType:'client',tenantId:client } })
    state.owner=null
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ assessmentDelivery:false, teamManagement:false })
    await expect(getTenantWorkspaceFeatures('partner',b)).rejects.toThrow('not accessible')
    state.error=true
    await expect(getEffectiveWorkspaceFeatures()).rejects.toThrow('Unable to load')
  })
  it('preserves unconfined admin inspection even if the tenant disables team management', async () => {
    state.rows[a]=row({ teamManagement:false })
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ teamManagement:true })
    state.scope=scope({ requestSurface:'partner',partnerIds:[a],activeContext:{surface:'partner',tenantType:'partner',tenantId:a},supportSession:{id:'synthetic'} as never })
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ teamManagement:false })
    await expect(setTenantWorkspaceFeature({type:'partner',id:a},{key:'teamManagement',value:true})).rejects.toThrow('Only Trajectas')
    expect(state.rpc).not.toHaveBeenCalled()
  })
  it('sends independent field patches and reviewed configurations through the transactional RPC', async () => {
    const before=defaultWorkspaceFeatures('partner'), next=previewFeatureChange(before,'assessmentAuthoring',false)
    state.rpc.mockResolvedValue({data:next,error:null})
    await setTenantWorkspaceFeature({type:'partner',id:a},{key:'compare',value:false})
    expect(state.rpc).toHaveBeenLastCalledWith('patch_workspace_features',expect.objectContaining({ p_patch:{compare:false},p_origin:'override',p_actor:actor }))
    await applyWorkspaceFeatureConfiguration({type:'partner',id:a},next,before,'dependency')
    expect(state.rpc).toHaveBeenLastCalledWith('patch_workspace_features',expect.objectContaining({p_patch:next,p_expected:before,p_origin:'dependency'}))
  })
  it('rejects RPC conflicts without retrying a stale reviewed proposal', async () => {
    state.rpc.mockResolvedValue({data:null,error:{message:'Workspace features changed. Refresh and review the new diff.'}})
    const before=defaultWorkspaceFeatures('partner')
    await expect(applyWorkspaceFeatureConfiguration({type:'partner',id:a},before,before,'dependency')).rejects.toThrow('changed')
    expect(state.rpc).toHaveBeenCalledTimes(1)
  })
  it('returns only bounded tenant feature audit DTOs and denies confined inspection', async () => {
    state.history=[{id:'event',created_at:'2026-10-07T00:00:00Z',actor_profile_id:actor,metadata:{origin:'override',previous:{compare:true},next:{compare:false,role:'platform_admin'}}}]
    expect(await getWorkspaceFeatureHistory({type:'partner',id:a})).toEqual([{id:'event',createdAt:'2026-10-07T00:00:00Z',actorId:actor,origin:'override',changes:[{key:'compare',before:true,after:false}]}])
    expect(state.calls.find(call=>call.table==='audit_events')?.filters).toContainEqual(['partner_id',a])
    state.scope=scope({requestSurface:'partner',isPlatformAdmin:false,partnerIds:[a]})
    await expect(getWorkspaceFeatureHistory({type:'partner',id:a})).rejects.toThrow('Only Trajectas')
  })
})
