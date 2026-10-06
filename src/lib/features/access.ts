import 'server-only'
import { AuthorizationError } from '@/lib/auth/authorization'
import { getEffectiveWorkspaceFeatures } from '@/lib/dal/workspace-features'
import { EXPERIENCE_FEATURE, type InsightExperience, type InsightFeature } from './workspace-features'
import { insightExperienceSchema } from '@/lib/validations/workspace-features'
export async function requireWorkspaceFeature(feature: InsightFeature) {
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

export async function isWorkspaceFeatureEnabled(feature: InsightFeature): Promise<boolean> {
  return (await getEffectiveWorkspaceFeatures())[feature]
}
