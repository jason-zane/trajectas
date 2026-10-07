import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { CampaignOverviewPageComponent } from "@/components/campaigns/pages/campaign-overview-page";

export default async function PartnerCampaignOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

  const { id } = await params;
  return <CampaignOverviewPageComponent campaignId={id} surface="partner" />;
}
