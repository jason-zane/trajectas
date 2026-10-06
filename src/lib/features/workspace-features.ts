/** Serializable workspace capabilities. Entity access and staff roles remain separate. */
export const INSIGHT_FEATURES = [
  { key: 'compare', label: 'Compare', description: 'Compare participants side by side, including saved comparisons and campaign comparisons.' },
  { key: 'trajectory', label: 'Trajectory', description: 'Explore one person’s results and linked assessment history over time.' },
  { key: 'unifiedTrajectory', label: 'Unified Trajectory', description: 'Explore multiple people and their assessment histories in one workspace.' },
] as const
export type InsightFeature = typeof INSIGHT_FEATURES[number]['key']
export type InsightExperience = 'compare' | 'individual' | 'unified'
export type DashboardStyle = 'default' | 'operational' | 'portfolio'
export type WorkspaceFeatures = Record<InsightFeature, boolean> & { dashboardStyle: DashboardStyle }
export type FeatureSettingKey = InsightFeature | 'dashboardStyle'
export type FeatureTenant = { type: 'partner' | 'client'; id: string }
export const EXPERIENCE_FEATURE: Record<InsightExperience, InsightFeature> = {
  compare: 'compare', individual: 'trajectory', unified: 'unifiedTrajectory',
}
export function defaultWorkspaceFeatures(type: FeatureTenant['type'] | 'admin'): WorkspaceFeatures {
  return { compare: true, trajectory: true, unifiedTrajectory: type !== 'client', dashboardStyle: 'default' }
}
export const DISABLED_WORKSPACE_FEATURES: WorkspaceFeatures = {
  compare: false, trajectory: false, unifiedTrajectory: false, dashboardStyle: 'default',
}
/** Aggregate contexts use the intersection so one enabled tenant cannot unlock another. */
export function intersectWorkspaceFeatures(configs: WorkspaceFeatures[]): WorkspaceFeatures {
  if (!configs.length) return { ...DISABLED_WORKSPACE_FEATURES }
  return {
    compare: configs.every(c => c.compare),
    trajectory: configs.every(c => c.trajectory),
    unifiedTrajectory: configs.every(c => c.unifiedTrajectory),
    dashboardStyle: configs.every(c => c.dashboardStyle === configs[0].dashboardStyle) ? configs[0].dashboardStyle : 'default',
  }
}
export function featureForInsightPath(path: string): InsightFeature | null {
  if (/\/participants\/unified(?:\/|$)/.test(path)) return 'unifiedTrajectory'
  if (/\/participants\/trajectory(?:\/|$)/.test(path)) return 'trajectory'
  if (/\/(?:participants|campaigns\/[^/]+)\/compare(?:\/|$)/.test(path)) return 'compare'
  return null
}

export class MultipleTrajectoryPeopleError extends Error {
  constructor() { super('Individual Trajectory supports one person. Open Unified Trajectory to explore multiple people.'); this.name = 'MultipleTrajectoryPeopleError' }
}
