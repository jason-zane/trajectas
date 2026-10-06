import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { CampaignParticipantsPageComponent } from "@/components/campaigns/pages/campaign-participants-page";

export default async function ClientCampaignParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

  const { id } = await params;
  return <CampaignParticipantsPageComponent campaignId={id} surface="client" />;
}
