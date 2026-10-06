import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthorizedScope } from '@/lib/auth/authorization'
import { defaultWorkspaceFeatures } from '@/lib/features/workspace-features'
import { workspacePreset } from '@/lib/features/workspace-presets'
const mocks = vi.hoisted(() => ({ scope: vi.fn(), insert: vi.fn(), update: vi.fn(), rpc: vi.fn(), features: vi.fn() }))
const partner = '11111111-1111-4111-8111-111111111111'
const client = '22222222-2222-4222-8222-222222222222'
const actor = '33333333-3333-4333-8333-333333333333'
vi.mock('@/lib/auth/authorization', async original => ({ ...await original<typeof import('@/lib/auth/authorization')>(), resolveAuthorizedScope: mocks.scope, requireClientAccess: async (clientId: string) => ({ scope: await mocks.scope(), clientId, partnerId: null }) }))
vi.mock('@/lib/dal/workspace-features', () => ({ getEffectiveWorkspaceFeatures: mocks.features }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc: mocks.rpc, from: (table: string) => {
  const query: Record<string, unknown> = {}
  for (const method of ['select','eq','is','single']) query[method] = () => query
  query.update = (value: unknown) => { mocks.update(table, value); return query }
  query.insert = (value: unknown) => { mocks.insert(table, value); return query }
  query.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: { id: table === 'partners' ? partner : client }, error: null }).then(resolve)
  return query
} }) }))
vi.mock('@/lib/auth/support-sessions', () => ({ logAuditEvent: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), unstable_cache: (fn: unknown) => fn }))
import { createClient, updateClient } from '@/app/actions/clients'
import { provisionWorkspaceWithFeatures } from '@/lib/dal/workspace-provisioning'
const partnerScope: AuthorizedScope = {
  actor: { id: actor, email: 'synthetic@test.local', role: 'partner_admin', isActive: true, partnerMemberships: [], clientMemberships: [], activeContext: null },
  activeContext: { surface: 'partner', tenantType: 'partner', tenantId: partner }, previewContext: null, requestSurface: 'partner',
  isPlatformAdmin: false, isLocalDevelopmentBypass: false, isLocalDevelopment: false, supportSession: null,
  partnerIds: [partner], partnerAdminIds: [partner], clientIds: [], clientAdminIds: [], managedClientIds: [],
}
function form(withFeatures = false) {
  const data = new FormData(); data.set('name','Synthetic client'); data.set('slug','synthetic-client')
  if (withFeatures) { data.set('featurePreset','client'); data.set('featureConfiguration',JSON.stringify(workspacePreset('client','client'))) }
  return data
}
beforeEach(() => { vi.clearAllMocks(); mocks.scope.mockResolvedValue(partnerScope); mocks.features.mockResolvedValue(defaultWorkspaceFeatures('partner')); mocks.rpc.mockResolvedValue({ data: client, error: null }) })
describe('provisioning preserves existing partner authority and defaults', () => {
  it('creates a partner client through the legacy path without writing feature settings', async () => {
    expect(await createClient(form())).toMatchObject({ success: true, id: client })
    expect(mocks.insert).toHaveBeenCalledExactlyOnceWith('clients', expect.objectContaining({ partner_id: partner }))
    expect(mocks.rpc).not.toHaveBeenCalled()
    expect(defaultWorkspaceFeatures('client')).toMatchObject({ assessmentDelivery: true, assessmentAuthoring: true, unifiedTrajectory: false })
  })
  it('allows starter directory reads without enabling provisioning, client management or allocations', async () => {
    const starter = workspacePreset('partnerStarter','partner')
    mocks.features.mockResolvedValue(starter)
    expect(starter).toMatchObject({clientDirectory:true,clientProvisioning:false,clientManagement:false,clientAssessmentAllocation:false,clientTemplateAllocation:false})
    await expect(createClient(form())).rejects.toThrow('not enabled')
    await expect(updateClient(client,form())).rejects.toThrow('not enabled')
    expect(mocks.insert).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each([null, partnerScope.activeContext])('denies alternate admin-surface partner calls with context %s before mutation', async context => {
    mocks.scope.mockResolvedValue({ ...partnerScope, requestSurface: 'admin', activeContext: context, managedClientIds: [client], clientIds: [client] })
    mocks.features.mockResolvedValue({ ...defaultWorkspaceFeatures('partner'), clientProvisioning: false, clientManagement: false })
    await expect(createClient(form())).rejects.toThrow('request surface')
    await expect(updateClient(client, form())).rejects.toThrow('request surface')
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('does not let partner-admin memberships provision a new client through a client surface', async () => {
    mocks.scope.mockResolvedValue({ ...partnerScope, requestSurface: 'client', activeContext: { surface: 'client', tenantType: 'client', tenantId: client }, clientIds: [client], managedClientIds: [client] })
    mocks.features.mockResolvedValue(defaultWorkspaceFeatures('client'))
    await expect(createClient(form())).rejects.toThrow('not enabled')
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('preserves a client administrator’s own scoped editing without partner-only capabilities', async () => {
    mocks.scope.mockResolvedValue({ ...partnerScope, actor: { ...partnerScope.actor!, role: 'client_admin' }, requestSurface: 'client', activeContext: { surface: 'client', tenantType: 'client', tenantId: client }, partnerIds: [], partnerAdminIds: [], clientIds: [client], clientAdminIds: [client], managedClientIds: [client] })
    mocks.features.mockResolvedValue(defaultWorkspaceFeatures('client'))
    expect(await updateClient(client, form())).toMatchObject({ success: true })
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('rejects partner-supplied preset selection without writing a client or settings', async () => {
    expect(await createClient(form(true))).toMatchObject({ error: { _form: [expect.stringContaining('Only unrestricted')] } })
    expect(mocks.insert).not.toHaveBeenCalled(); expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it.each(['partner','client'] as const)('rejects direct %s provisioning selection outside the platform portal', async type => {
    await expect(provisionWorkspaceWithFeatures(type, {}, form(true))).rejects.toThrow('Only unrestricted')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('commits platform provisioning and explicit overrides through one atomic RPC', async () => {
    mocks.scope.mockResolvedValue({ ...partnerScope, requestSurface: 'admin', isPlatformAdmin: true, activeContext: null })
    const data = form(true); const features = { ...workspacePreset('client','client'), unifiedTrajectory: true }
    data.set('featureConfiguration',JSON.stringify(features))
    expect(await provisionWorkspaceWithFeatures('client',{ name: 'Synthetic', slug: 'synthetic', is_active: true },data)).toEqual({ id: client })
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('provision_workspace_with_features', expect.objectContaining({ p_features: features, p_actor: actor, p_origin: 'preset:client:v1:provisioning' }))
    expect(mocks.insert).not.toHaveBeenCalled()
  })
  it('rejects incompatible/forged feature configuration before provisioning', async () => {
    mocks.scope.mockResolvedValue({ ...partnerScope, requestSurface: 'admin', isPlatformAdmin: true, activeContext: null })
    const data = form(true); data.set('featureConfiguration',JSON.stringify({ ...workspacePreset('client','client'), clientProvisioning: true }))
    await expect(provisionWorkspaceWithFeatures('client',{},data)).rejects.toThrow('partner workspace')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
  it('keeps support sessions confined even when the actor has a platform role', async () => {
    mocks.scope.mockResolvedValue({ ...partnerScope, requestSurface: 'admin', isPlatformAdmin: true, activeContext: null, supportSession: { id: 'synthetic' } })
    await expect(provisionWorkspaceWithFeatures('client',{},form(true))).rejects.toThrow('Only unrestricted')
    expect(mocks.rpc).not.toHaveBeenCalled()
  })
})
