import 'server-only'
import { AuthorizationError } from '@/lib/auth/authorization'
import { getEffectiveWorkspaceFeatures } from '@/lib/dal/workspace-features'
import { EXPERIENCE_FEATURE, type InsightExperience, type WorkspaceFeature } from './workspace-features'
import { insightExperienceSchema } from '@/lib/validations/workspace-features'
export async function requireWorkspaceFeature(feature: WorkspaceFeature) {
  const features = await getEffectiveWorkspaceFeatures()
  if (!features[feature]) throw new AuthorizationError('This feature is not enabled for your workspace.')
}
export async function requireInsightExperience(experience: InsightExperience) {
  const parsed = insightExperienceSchema.parse(experience)
  await requireWorkspaceFeature(EXPERIENCE_FEATURE[parsed])
  return parsed
}
/** Shared pickers can be used by any enabled insight; score operations check the specific experience. */
export async function requireAnyInsightFeature() {
  const features = await getEffectiveWorkspaceFeatures()
  if (!features.compare && !features.trajectory && !features.unifiedTrajectory) {
    throw new AuthorizationError('Insights are not enabled for your workspace.')
  }
}

export async function isWorkspaceFeatureEnabled(feature: WorkspaceFeature): Promise<boolean> {
  return (await getEffectiveWorkspaceFeatures())[feature]
}

/** Partner controls do not disable a client's own administrative operations. */
export async function requirePartnerWorkspaceFeature(feature: import('./workspace-features').ModuleFeature, targetClientId?: string) {
  const { resolveAuthorizedScope } = await import('@/lib/auth/authorization')
  const scope = await resolveAuthorizedScope()
  const context = scope.activeContext ?? scope.previewContext
  if (scope.requestSurface === 'public' || scope.requestSurface === 'assess' || (scope.requestSurface === 'admin' && !scope.isPlatformAdmin)) {
    throw new AuthorizationError('Partner controls are unavailable from this request surface.')
  }
  if (scope.requestSurface === 'client' && feature === 'clientManagement') {
    // This exception preserves existing own-client administration, not the
    // partner-derived managed set. Every mutation supplies its actual target.
    if (targetClientId && scope.clientIds.includes(targetClientId) && scope.clientAdminIds.includes(targetClientId)) return
    throw new AuthorizationError('You do not administer this client directly.')
  }
  if (scope.requestSurface === 'client') return requireWorkspaceFeature(feature)
  if (feature === 'clientProvisioning' || scope.requestSurface === 'partner' || (scope.requestSurface === 'admin' && context?.tenantType === 'partner')) await requireWorkspaceFeature(feature)
}
