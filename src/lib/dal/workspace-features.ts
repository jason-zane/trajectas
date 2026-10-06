import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthorizationError, resolveAuthorizedScope, isUnconfinedPlatformAdmin } from '@/lib/auth/authorization'
import {
  defaultWorkspaceFeatures, intersectWorkspaceFeatures, DISABLED_WORKSPACE_FEATURES,
  MODULE_FEATURES, type ModuleFeature, type FeatureTenant, type WorkspaceFeatures,
} from '@/lib/features/workspace-features'
import { featureTenantSchema, featureSettingSchema } from '@/lib/validations/workspace-features'

type FeatureRow = { compare_enabled: boolean; trajectory_enabled: boolean; unified_trajectory_enabled: boolean; dashboard_style: WorkspaceFeatures['dashboardStyle']; module_flags?: Partial<Record<ModuleFeature, boolean>>; client_id?: string | null }
function mapFeatures(row: FeatureRow): WorkspaceFeatures {
  return { ...defaultWorkspaceFeatures(row.client_id ? 'client' : 'partner'), ...row.module_flags, compare: row.compare_enabled, trajectory: row.trajectory_enabled, unifiedTrajectory: row.unified_trajectory_enabled, dashboardStyle: row.dashboard_style }
}
async function requireTenantFeatureAccess(tenant: FeatureTenant) {
  const scope = await resolveAuthorizedScope()
  const allowed = isUnconfinedPlatformAdmin(scope) || (tenant.type === 'partner' ? scope.partnerIds.includes(tenant.id) : scope.clientIds.includes(tenant.id))
  if (!allowed) throw new AuthorizationError('This workspace is not accessible.')
  return scope
}
export const getTenantWorkspaceFeatures = cache(async (tenantType: FeatureTenant['type'], tenantId: string): Promise<WorkspaceFeatures> => {
  const tenant = featureTenantSchema.parse({ type: tenantType, id: tenantId })
  await requireTenantFeatureAccess(tenant)
  const { data, error } = await createAdminClient().from('workspace_feature_settings')
    .select('compare_enabled, trajectory_enabled, unified_trajectory_enabled, dashboard_style, module_flags, client_id')
    .eq(tenant.type === 'partner' ? 'partner_id' : 'client_id', tenant.id).maybeSingle()
  if (error) throw new Error('Unable to load workspace features.')
  return data ? mapFeatures(data as FeatureRow) : defaultWorkspaceFeatures(tenant.type)
})

/** The selected portal determines whose tools are licensed; membership still scopes all data. */
export const getEffectiveWorkspaceFeatures = cache(async (): Promise<WorkspaceFeatures> => {
  const scope = await resolveAuthorizedScope()
  if (scope.requestSurface === 'admin' && isUnconfinedPlatformAdmin(scope)) return defaultWorkspaceFeatures('admin')
  const context = scope.activeContext ?? scope.previewContext
  const type = scope.requestSurface === 'partner' ? 'partner'
    : scope.requestSurface === 'client' ? 'client' : context?.tenantType
  if (!type) return { ...DISABLED_WORKSPACE_FEATURES }
  let ids = type === 'partner' ? scope.partnerIds : scope.clientIds
  if (context?.tenantId) {
    if (type === context.tenantType) {
      ids = ids.includes(context.tenantId) ? [context.tenantId] : []
    } else if (type === 'partner' && context.tenantType === 'client') {
      // A selected client narrows clientIds, but partnerIds can still include
      // unrelated memberships. License tools from this client's current owner.
      if (!scope.clientIds.includes(context.tenantId) || !scope.partnerIds.length) return { ...DISABLED_WORKSPACE_FEATURES }
      const { data: owner, error } = await createAdminClient().from('clients')
        .select('partner_id').eq('id', context.tenantId)
        .in('partner_id', scope.partnerIds).is('deleted_at', null).maybeSingle()
      if (error) throw new Error('Unable to load workspace features.')
      ids = owner?.partner_id ? [String(owner.partner_id)] : []
    }
  }
  if (!ids.length) return { ...DISABLED_WORKSPACE_FEATURES }
  const configs = await Promise.all(ids.map(id => getTenantWorkspaceFeatures(type, id)))
  const effective = intersectWorkspaceFeatures(configs)
  return effective
})

/** All feature mutations retain the phase-one unconfined platform gate. */
async function requireFeatureConfigurationAccess(tenant: FeatureTenant) {
  const scope = await requireTenantFeatureAccess(tenant)
  if (scope.requestSurface !== 'admin' || !isUnconfinedPlatformAdmin(scope) || !scope.actor?.id) {
    throw new AuthorizationError('Only Trajectas administrators outside a support session can configure features.')
  }
  const { data: owner, error } = await createAdminClient().from(tenant.type === 'partner' ? 'partners' : 'clients')
    .select('id').eq('id', tenant.id).is('deleted_at', null).single()
  if (error || !owner) throw new AuthorizationError('Workspace not found.')
  return scope.actor.id
}
export async function setTenantWorkspaceFeature(tenantInput: FeatureTenant, settingInput: unknown): Promise<WorkspaceFeatures> {
  const tenant = featureTenantSchema.parse(tenantInput)
  const setting = featureSettingSchema.parse(settingInput)
  const actorId = await requireFeatureConfigurationAccess(tenant)
  if (tenant.type === 'client' && setting.key === 'dashboardStyle' && setting.value === 'portfolio') {
    throw new AuthorizationError('Portfolio dashboards are available in partner workspaces only.')
  }
  if (tenant.type === 'client' && MODULE_FEATURES.some(f => f.key === setting.key && 'partnerOnly' in f) && setting.value) {
    throw new AuthorizationError('This feature is available in partner workspaces only.')
  }
  const { data, error } = await createAdminClient().rpc('patch_workspace_features', {
    p_tenant_type: tenant.type, p_tenant_id: tenant.id, p_actor: actorId,
    p_patch: { [setting.key]: setting.value }, p_origin: 'override',
  })
  if (error || !data) throw new Error(error?.message ?? 'Unable to update workspace features.')
  return data as WorkspaceFeatures
}

/** Approved preview diff is committed atomically or rejected if another administrator changed it. */
export async function applyWorkspaceFeatureConfiguration(tenantInput: FeatureTenant, configurationInput: unknown, expectedInput: unknown, origin: 'dependency' | 'preset:client:v1' | 'preset:partnerStarter:v1' | 'preset:fullPartner:v1'): Promise<WorkspaceFeatures> {
  const tenant = featureTenantSchema.parse(tenantInput)
  const { workspaceFeatureConfigurationSchema } = await import('@/lib/validations/workspace-features')
  const configuration = workspaceFeatureConfigurationSchema.parse(configurationInput) as WorkspaceFeatures
  const expected = workspaceFeatureConfigurationSchema.parse(expectedInput) as WorkspaceFeatures
  const actorId = await requireFeatureConfigurationAccess(tenant)
  const { validateWorkspaceFeatures } = await import('@/lib/features/workspace-features')
  validateWorkspaceFeatures(configuration, tenant.type)
  const { data, error } = await createAdminClient().rpc('patch_workspace_features', {
    p_tenant_type: tenant.type, p_tenant_id: tenant.id, p_actor: actorId,
    p_patch: configuration, p_expected: expected, p_origin: origin,
  })
  if (error || !data) throw new Error(error?.message ?? 'Unable to update workspace features.')
  return data as WorkspaceFeatures
}

/** Called only after an existing integration credential has resolved its client owner.
 * No portal actor is manufactured and no membership/credential grant changes. */
export const getIntegrationClientFeatures = cache(async (clientId: string): Promise<WorkspaceFeatures> => {
  const tenant = featureTenantSchema.parse({ type: 'client', id: clientId })
  const { data, error } = await createAdminClient().from('workspace_feature_settings')
    .select('compare_enabled, trajectory_enabled, unified_trajectory_enabled, dashboard_style, module_flags, client_id')
    .eq('client_id', tenant.id).maybeSingle()
  if (error) throw new Error('Unable to load workspace features.')
  return data ? mapFeatures(data as FeatureRow) : defaultWorkspaceFeatures('client')
})

export type WorkspaceFeatureHistoryItem = {
  id: string; createdAt: string; actorId: string | null; origin: string;
  changes: { key: string; before: boolean | string | null; after: boolean | string }[];
}
/** The Features tab's history shares its existing unrestricted platform-admin boundary. */
export async function getWorkspaceFeatureHistory(tenantInput: FeatureTenant): Promise<WorkspaceFeatureHistoryItem[]> {
  const tenant = featureTenantSchema.parse(tenantInput)
  await requireFeatureConfigurationAccess(tenant)
  const { data, error } = await createAdminClient().from('audit_events')
    .select('id, created_at, actor_profile_id, metadata')
    .eq('event_type', 'workspace.features_updated').eq('target_table', 'workspace_feature_settings')
    .eq(tenant.type === 'partner' ? 'partner_id' : 'client_id', tenant.id)
    .order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error('Unable to load workspace feature history.')
  const { WORKSPACE_FEATURE_KEYS } = await import('@/lib/features/workspace-features')
  return (data ?? []).map(row => {
    const metadata = row.metadata as { origin?: unknown; previous?: Record<string, unknown>; next?: Record<string, unknown> } | null
    const changes: WorkspaceFeatureHistoryItem['changes'] = []
    for (const key of [...WORKSPACE_FEATURE_KEYS, 'dashboardStyle']) {
      const after = metadata?.next?.[key]
      const before = metadata?.previous?.[key]
      if ((typeof after === 'boolean' || typeof after === 'string') && before !== after) changes.push({ key, before: typeof before === 'boolean' || typeof before === 'string' ? before : null, after })
    }
    return { id: String(row.id), createdAt: String(row.created_at), actorId: row.actor_profile_id ?? null, origin: typeof metadata?.origin === 'string' ? metadata.origin : 'override', changes }
  })
}
