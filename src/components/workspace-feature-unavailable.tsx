import { EmptyState } from '@/components/empty-state'
import { INSIGHT_FEATURES, MODULE_FEATURES, type WorkspaceFeature } from '@/lib/features/workspace-features'
export function WorkspaceFeatureUnavailable({ feature }: { feature: WorkspaceFeature }) {
  const label = [...INSIGHT_FEATURES, ...MODULE_FEATURES].find(item => item.key === feature)?.label ?? 'This feature'
  return <EmptyState eyebrow="Workspace features" title={`${label} is not enabled`} description="Contact Trajectas to enable this tool for your workspace. Your existing records are retained." />
}
