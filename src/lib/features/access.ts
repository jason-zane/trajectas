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
export async function requirePartnerWorkspaceFeature(feature: import('./workspace-features').ModuleFeature) {
  const { resolveAuthorizedScope } = await import('@/lib/auth/authorization')
  const scope = await resolveAuthorizedScope()
  const context = scope.activeContext ?? scope.previewContext
  if (scope.requestSurface === 'partner' || (scope.requestSurface === 'admin' && context?.tenantType === 'partner')) await requireWorkspaceFeature(feature)
}
