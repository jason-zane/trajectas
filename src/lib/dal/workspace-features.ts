import 'server-only'
import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { AuthorizationError, resolveAuthorizedScope, isUnconfinedPlatformAdmin } from '@/lib/auth/authorization'
import {
  defaultWorkspaceFeatures, intersectWorkspaceFeatures, DISABLED_WORKSPACE_FEATURES,
  type FeatureTenant, type WorkspaceFeatures,
} from '@/lib/features/workspace-features'
import { featureTenantSchema, featureSettingSchema } from '@/lib/validations/workspace-features'

type FeatureRow = { compare_enabled: boolean; trajectory_enabled: boolean; unified_trajectory_enabled: boolean; dashboard_style: WorkspaceFeatures['dashboardStyle'] }
function mapFeatures(row: FeatureRow): WorkspaceFeatures {
  return { compare: row.compare_enabled, trajectory: row.trajectory_enabled, unifiedTrajectory: row.unified_trajectory_enabled, dashboardStyle: row.dashboard_style }
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
    .select('compare_enabled, trajectory_enabled, unified_trajectory_enabled, dashboard_style')
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
  const ids = type === 'partner' ? scope.partnerIds : scope.clientIds
  if (!ids.length) return { ...DISABLED_WORKSPACE_FEATURES }
  const configs = await Promise.all(ids.map(id => getTenantWorkspaceFeatures(type, id)))
  const effective = intersectWorkspaceFeatures(configs)
  // Unified Trajectory currently has no client portal route; a setting never creates one.
  if (type === 'client') effective.unifiedTrajectory = false
  return effective
})

const columns = { compare: 'compare_enabled', trajectory: 'trajectory_enabled', unifiedTrajectory: 'unified_trajectory_enabled', dashboardStyle: 'dashboard_style' } as const
export async function setTenantWorkspaceFeature(tenantInput: FeatureTenant, settingInput: unknown): Promise<WorkspaceFeatures> {
  const tenant = featureTenantSchema.parse(tenantInput)
  const setting = featureSettingSchema.parse(settingInput)
  const scope = await requireTenantFeatureAccess(tenant)
  if (scope.requestSurface !== 'admin' || !isUnconfinedPlatformAdmin(scope) || !scope.actor?.id) {
    throw new AuthorizationError('Only Trajectas administrators outside a support session can configure features.')
  }
  if (tenant.type === 'client' && ((setting.key === 'unifiedTrajectory' && setting.value) || (setting.key === 'dashboardStyle' && setting.value === 'portfolio'))) {
    throw new AuthorizationError('This feature is currently available in partner workspaces only.')
  }
  const db = createAdminClient()
  const ownerColumn = tenant.type === 'partner' ? 'partner_id' : 'client_id'
  const { data: owner, error: ownerError } = await db.from(tenant.type === 'partner' ? 'partners' : 'clients')
    .select('id').eq('id', tenant.id).is('deleted_at', null).single()
  if (ownerError || !owner) throw new AuthorizationError('Workspace not found.')
  const patch = { [columns[setting.key]]: setting.value, updated_by: scope.actor.id }
  const update = () => db.from('workspace_feature_settings').update(patch).eq(ownerColumn, tenant.id)
    .select('compare_enabled, trajectory_enabled, unified_trajectory_enabled, dashboard_style').maybeSingle()
  let result = await update()
  if (result.error) throw new Error('Unable to update workspace features.')
  if (!result.data) {
    const defaults = defaultWorkspaceFeatures(tenant.type)
    result = await db.from('workspace_feature_settings').insert({
      [ownerColumn]: tenant.id, compare_enabled: defaults.compare, trajectory_enabled: defaults.trajectory,
      unified_trajectory_enabled: defaults.unifiedTrajectory, dashboard_style: defaults.dashboardStyle, ...patch,
    }).select('compare_enabled, trajectory_enabled, unified_trajectory_enabled, dashboard_style').maybeSingle()
    // Two first-time changes can race. Update ONLY this field after a competing insert.
    if (result.error?.code === '23505') result = await update()
  }
  if (result.error || !result.data) throw new Error('Unable to update workspace features.')
  return mapFeatures(result.data as FeatureRow)
}
