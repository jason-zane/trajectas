import type { ReactNode } from 'react'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'

export default async function PartnerIntegrationsLayout({ children }: { children: ReactNode }) {
  if (!await isWorkspaceFeatureEnabled('integrationManagement')) return <WorkspaceFeatureUnavailable feature="integrationManagement" />
  return <>{children}</>
}
