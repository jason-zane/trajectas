import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { CampaignBrandingPageComponent } from "@/components/campaigns/pages/campaign-branding-page"

export default async function CampaignBrandingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!await isWorkspaceFeatureEnabled('campaignBranding')) return <WorkspaceFeatureUnavailable feature="campaignBranding" />

  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

  const { id } = await params
  return <CampaignBrandingPageComponent campaignId={id} />
}
