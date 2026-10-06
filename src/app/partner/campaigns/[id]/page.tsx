import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { redirect } from "next/navigation";

export default async function PartnerCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

  const { id } = await params;
  redirect(`/partner/campaigns/${id}/overview`);
}
