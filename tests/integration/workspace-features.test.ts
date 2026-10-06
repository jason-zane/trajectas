import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { canRun, createAdminClient, createTestUser } from './_helpers/rls-fixture'
import { defaultWorkspaceFeatures, previewFeatureChange } from '@/lib/features/workspace-features'
import { workspacePreset } from '@/lib/features/workspace-presets'
import type { AuthorizedScope } from '@/lib/auth/authorization'
const request = vi.hoisted(() => ({ scope: null as AuthorizedScope | null }))
vi.mock('@/lib/auth/authorization', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/auth/authorization')>(), resolveAuthorizedScope: async () => request.scope,
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient }))
import { getTenantWorkspaceFeatures, getEffectiveWorkspaceFeatures, setTenantWorkspaceFeature, applyWorkspaceFeatureConfiguration } from '@/lib/dal/workspace-features'

describe.skipIf(!canRun)('workspace features: real local ownership, RLS and audit', () => {
  const db = createAdminClient()
  const ids = { a: randomUUID(), b: randomUUID(), client: randomUUID() }
  const users: Awaited<ReturnType<typeof createTestUser>>[] = []
  let platform: AuthorizedScope
  beforeAll(async () => {
    const p = await db.from('partners').insert([{ id: ids.a, name: 'Features A', slug: ids.a }, { id: ids.b, name: 'Features B', slug: ids.b }])
    if (p.error) throw p.error
    const c = await db.from('clients').insert({ id: ids.client, name: 'Features client', slug: ids.client, partner_id: ids.a })
    if (c.error) throw c.error
    users.push(await createTestUser(db, { email: `features-admin-${randomUUID()}@test.local`, role: 'platform_admin' }))
    users.push(await createTestUser(db, { email: `features-a-${randomUUID()}@test.local`, role: 'partner_admin', partnerId: ids.a }))
    const membership = await db.from('partner_memberships').insert({ profile_id: users[1].userId, partner_id: ids.a, role: 'admin' })
    if (membership.error) throw membership.error
    platform = {
      actor: { id: users[0].userId, email: 'admin@test.local', role: 'platform_admin', isActive: true, partnerMemberships: [], clientMemberships: [], activeContext: null },
      requestSurface: 'admin', isPlatformAdmin: true, isLocalDevelopmentBypass: false, isLocalDevelopment: false,
      activeContext: null, previewContext: null, supportSession: null,
      partnerIds: [], partnerAdminIds: [], clientIds: [], clientAdminIds: [], managedClientIds: [],
    }
    request.scope = platform
  }, 30000)
  afterAll(async () => {
    request.scope = platform
    async function clean(result: { error: { message: string } | null }) {
      if (result.error) throw new Error(result.error.message)
    }
    await clean(await db.from('workspace_feature_settings').delete().in('partner_id', [ids.a, ids.b]))
    // Audit events are append-only. Owner/profile deletion nulls their foreign keys.
    await clean(await db.from('clients').delete().eq('id', ids.client))
    for (const user of users) {
      await clean(await db.from('partner_memberships').delete().eq('profile_id', user.userId))
      await clean(await db.from('profiles').delete().eq('id', user.userId))
      await clean(await db.auth.admin.deleteUser(user.userId))
    }
    await clean(await db.from('partners').delete().in('id', [ids.a, ids.b]))
  }, 30000)
  it('keeps legacy defaults without creating a settings row', async () => {
    expect(await getTenantWorkspaceFeatures('partner', ids.a)).toMatchObject({ compare: true, trajectory: true, unifiedTrajectory: true })
    const result = await db.from('workspace_feature_settings').select('id').eq('partner_id', ids.a)
    expect(result.data).toEqual([])
  })
  it('patches independent switches and records the change in the same transaction', async () => {
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'compare', value: false })
    const next = await setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'trajectory', value: false })
    expect(next).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: true })
    const events = await db.from('audit_events').select('metadata').eq('event_type', 'workspace.features_updated').eq('partner_id', ids.a).order('created_at')
    expect(events.error).toBeNull()
    expect(events.data).toHaveLength(2)
    expect(events.data![1].metadata).toMatchObject({ previous: { compare: false, trajectory: true }, next: { compare: false, trajectory: false } })
  })
  it('allows a member to read only their partner configuration and blocks all authenticated writes', async () => {
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.b }, { key: 'compare', value: false })
    const rows = await users[1].client.from('workspace_feature_settings').select('partner_id')
    expect(rows.error).toBeNull()
    expect(rows.data).toEqual([{ partner_id: ids.a }])
    for (const user of users) {
      const write = await user.client.from('workspace_feature_settings').update({ compare_enabled: true }).eq('partner_id', ids.a)
      expect(write.error?.code).toBe('42501')
    }
  })
  it('restricts aggregate workspaces and support contexts instead of using platform role as a bypass', async () => {
    request.scope = { ...platform, requestSurface: 'partner', isPlatformAdmin: false, partnerIds: [ids.a, ids.b], activeContext: null }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: true })
    await expect(setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'compare', value: true })).rejects.toThrow('Only Trajectas')
    request.scope = platform
  })
  it('preserves platform-admin confinement inside a support session', async () => {
    request.scope = { ...platform, requestSurface: 'partner', partnerIds: [ids.a], activeContext: { surface: 'partner', tenantType: 'partner', tenantId: ids.a }, supportSession: { id: randomUUID(), actorProfileId: users[0].userId, targetSurface: 'partner', targetTenantId: ids.a, reason: 'Feature check', sessionKey: 'local-test', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now()+60000).toISOString(), metadata: {} } }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: true })
    await expect(setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'compare', value: true })).rejects.toThrow('Only Trajectas')
    request.scope = platform
  })
  it('preserves both fields during concurrent first-time updates', async () => {
    await db.from('workspace_feature_settings').delete().eq('partner_id', ids.b)
    await Promise.all([
      setTenantWorkspaceFeature({ type: 'partner', id: ids.b }, { key: 'trajectory', value: false }),
      setTenantWorkspaceFeature({ type: 'partner', id: ids.b }, { key: 'unifiedTrajectory', value: false }),
    ])
    expect(await getTenantWorkspaceFeatures('partner', ids.b)).toMatchObject({ compare: true, trajectory: false, unifiedTrajectory: false })
  })
  it('denies an unrelated tenant lookup and unsupported client settings', async () => {
    request.scope = { ...platform, requestSurface: 'partner', isPlatformAdmin: false, partnerIds: [ids.a], activeContext: { surface: 'partner', tenantType: 'partner', tenantId: ids.a } }
    await expect(getTenantWorkspaceFeatures('partner', ids.b)).rejects.toThrow('not accessible')
    request.scope = platform
    expect(await setTenantWorkspaceFeature({ type: 'client', id: ids.client }, { key: 'unifiedTrajectory', value: true })).toMatchObject({ unifiedTrajectory: true })
    await expect(setTenantWorkspaceFeature({ type: 'client', id: ids.client }, { key: 'clientDirectory', value: true })).rejects.toThrow('partner workspaces only')
    await expect(setTenantWorkspaceFeature({ type: 'client', id: ids.client }, { key: 'dashboardStyle', value: 'portfolio' })).rejects.toThrow('partner workspaces only')
  })
  it('uses the selected client’s owning partner rather than unrelated memberships', async () => {
    request.scope = platform
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'compare', value: true })
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'trajectory', value: true })
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.a }, { key: 'dashboardStyle', value: 'operational' })
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.b }, { key: 'compare', value: false })
    await setTenantWorkspaceFeature({ type: 'partner', id: ids.b }, { key: 'dashboardStyle', value: 'portfolio' })
    await setTenantWorkspaceFeature({ type: 'client', id: ids.client }, { key: 'compare', value: false })
    request.scope = { ...platform, requestSurface: 'partner', isPlatformAdmin: false, partnerIds: [ids.a, ids.b], clientIds: [ids.client], activeContext: { surface: 'partner', tenantType: 'client', tenantId: ids.client } }
    expect(await getEffectiveWorkspaceFeatures()).toEqual({ ...defaultWorkspaceFeatures('partner'), dashboardStyle: 'operational' })
    // The same client's own portal uses its own licence, not the parent's.
    request.scope = { ...request.scope, requestSurface: 'client' }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ compare: false, trajectory: true, unifiedTrajectory: true })
    request.scope = platform
  })
  it('does not substitute another partner when the selected client has no eligible owner', async () => {
    const update = await db.from('clients').update({ partner_id: ids.b }).eq('id', ids.client)
    expect(update.error).toBeNull()
    request.scope = { ...platform, requestSurface: 'partner', isPlatformAdmin: false, partnerIds: [ids.a], clientIds: [ids.client], activeContext: { surface: 'partner', tenantType: 'client', tenantId: ids.client } }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: false })
    const unassign = await db.from('clients').update({ partner_id: null }).eq('id', ids.client)
    expect(unassign.error).toBeNull()
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: false })
    request.scope = platform
  })
  it('denies an empty tenant context', async () => {
    request.scope = { ...platform, requestSurface: 'partner', isPlatformAdmin: false, partnerIds: [], activeContext: { surface: 'partner', tenantType: 'partner', tenantId: ids.a } }
    expect(await getEffectiveWorkspaceFeatures()).toMatchObject({ compare: false, trajectory: false, unifiedTrajectory: false })
    request.scope = platform
  })
  it('atomically applies a reviewed cascade, rejects stale diffs and audits overrides', async () => {
    request.scope = platform
    const tenant = { type: 'partner' as const, id: ids.a }
    const before = await getTenantWorkspaceFeatures('partner', ids.a)
    const next = previewFeatureChange(before, 'assessmentAuthoring', false)
    expect(await applyWorkspaceFeatureConfiguration(tenant, next, before, 'dependency')).toEqual(next)
    await expect(applyWorkspaceFeatureConfiguration(tenant, before, before, 'dependency')).rejects.toThrow('changed')
    const events = await db.from('audit_events').select('metadata').eq('partner_id', ids.a).eq('event_type','workspace.features_updated').order('created_at',{ ascending: false }).limit(1)
    expect(events.error).toBeNull()
    expect(events.data?.[0].metadata).toMatchObject({ origin: 'dependency', previous: before, next })
    const preset = workspacePreset('fullPartner','partner')
    expect(await applyWorkspaceFeatureConfiguration(tenant, preset, next, 'preset:fullPartner:v1')).toEqual(preset)
    expect(await setTenantWorkspaceFeature(tenant,{ key: 'compare', value: true })).toMatchObject({ ...preset, compare: true })
  })
  it('rejects incompatible SQL patches and unauthorized RPC callers', async () => {
    request.scope = platform
    const invalid = await db.rpc('patch_workspace_features', { p_tenant_type: 'partner', p_tenant_id: ids.a, p_actor: users[0].userId, p_patch: { assessmentAuthoring: false, assessmentPublishing: true } })
    expect(invalid.error?.message).toContain('requires')
    const invalidStyle = await db.rpc('patch_workspace_features', { p_tenant_type: 'partner', p_tenant_id: ids.a, p_actor: users[0].userId, p_patch: { dashboardStyle: null } })
    expect(invalidStyle.error?.message).toContain('Invalid dashboard')
    for (const user of users) {
      const result = await user.client.rpc('patch_workspace_features', { p_tenant_type: 'partner', p_tenant_id: ids.a, p_actor: user.userId, p_patch: { compare: true } })
      expect(result.error?.code).toBe('42501')
    }
  })
  it('keeps workspace provisioning and its audited configuration atomic', async () => {
    const slug = `features-provision-${randomUUID()}`
    const failed = await db.rpc('provision_workspace_with_features', { p_tenant_type:'client', p_record:{ name:'Synthetic rollback', slug, is_active:true }, p_actor:randomUUID(), p_features:workspacePreset('client','client'), p_origin:'preset:client:v1:provisioning' })
    expect(failed.error).not.toBeNull() // invalid audit actor fails after the owner INSERT
    const absent = await db.from('clients').select('id').eq('slug',slug)
    expect(absent.error).toBeNull(); expect(absent.data).toEqual([])
    const result = await db.rpc('provision_workspace_with_features', { p_tenant_type:'client', p_record:{ name:'Synthetic provision', slug, is_active:true }, p_actor:users[0].userId, p_features:workspacePreset('client','client'), p_origin:'preset:client:v1:provisioning' })
    expect(result.error).toBeNull(); expect(result.data).toBeTruthy()
    try {
      request.scope = platform
      expect(await getTenantWorkspaceFeatures('client',String(result.data))).toEqual(workspacePreset('client','client'))
      const audit = await db.from('audit_events').select('metadata').eq('client_id',result.data).eq('event_type','workspace.features_updated')
      expect(audit.error).toBeNull(); expect(audit.data).toHaveLength(1)
      expect(audit.data?.[0].metadata).toMatchObject({ origin:'preset:client:v1:provisioning', previous:defaultWorkspaceFeatures('client'), next:workspacePreset('client','client') })
    } finally {
      const settings = await db.from('workspace_feature_settings').delete().eq('client_id',result.data)
      if (settings.error) throw settings.error
      const client = await db.from('clients').delete().eq('id',result.data)
      if (client.error) throw client.error
    }
  })
  it('saves paused webhook events and releases only the explicitly reviewed tenant batch', async () => {
    request.scope=platform
    const tenant={type:'client' as const,id:ids.client}
    const queued=await db.from('integration_events_outbox').insert({client_id:ids.client,event_type:'integration.launch.created',aggregate_type:'launch',aggregate_id:randomUUID(),payload:{synthetic:true}}).select('id,status,requires_review').single()
    expect(queued.error).toBeNull();expect(queued.data).toMatchObject({status:'pending',requires_review:false})
    await setTenantWorkspaceFeature(tenant,{key:'webhookDelivery',value:false})
    expect((await db.from('integration_events_outbox').select('status,requires_review').eq('id',queued.data!.id).single()).data).toEqual({status:'failed',requires_review:true})
    const inserted=await db.from('integration_events_outbox').insert({client_id:ids.client,event_type:'integration.launch.created',aggregate_type:'launch',aggregate_id:randomUUID(),payload:{synthetic:true}}).select('id,status,requires_review,attempts').single()
    expect(inserted.error).toBeNull();expect(inserted.data).toMatchObject({status:'failed',requires_review:true,attempts:0})
    const eventId=inserted.data!.id
    const paused=await db.rpc('release_reviewed_webhook_events',{p_client_id:ids.client,p_actor:users[0].userId,p_ids:[eventId]})
    expect(paused.error?.message).toContain('Enable')
    await setTenantWorkspaceFeature(tenant,{key:'webhookDelivery',value:true})
    expect((await db.from('integration_events_outbox').select('status,requires_review').eq('id',eventId).single()).data).toEqual({status:'failed',requires_review:true})
    const stale=await db.rpc('release_reviewed_webhook_events',{p_client_id:ids.client,p_actor:users[0].userId,p_ids:[eventId,randomUUID()]})
    expect(stale.error?.message).toContain('changed')
    expect((await db.from('integration_events_outbox').select('requires_review').eq('id',eventId).single()).data?.requires_review).toBe(true)
    for(const user of users) expect((await user.client.rpc('release_reviewed_webhook_events',{p_client_id:ids.client,p_actor:user.userId,p_ids:[eventId]})).error?.code).toBe('42501')
    const released=await db.rpc('release_reviewed_webhook_events',{p_client_id:ids.client,p_actor:users[0].userId,p_ids:[eventId]})
    expect(released.error).toBeNull();expect(released.data).toBe(1)
    expect((await db.from('integration_events_outbox').select('status,requires_review,attempts').eq('id',eventId).single()).data).toEqual({status:'pending',requires_review:false,attempts:0})
    const audit=await db.from('audit_events').select('metadata').eq('event_type','integration.webhook_backlog_released').eq('client_id',ids.client)
    expect(audit.error).toBeNull();expect(audit.data?.[0].metadata).toEqual({eventIds:[eventId],count:1})
  })

})
