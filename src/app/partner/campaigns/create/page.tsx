import { getEffectiveWorkspaceFeatures } from '@/lib/dal/workspace-features';
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { redirect } from "next/navigation";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";
import { getClients } from "@/app/actions/clients";

export default async function PartnerCreateCampaignPage() {
  const features = await getEffectiveWorkspaceFeatures();
  if (!await isWorkspaceFeatureEnabled('campaignManagement') || !await isWorkspaceFeatureEnabled('assessmentDelivery')) return <WorkspaceFeatureUnavailable feature="campaignManagement" />

  const clients = features.clientDirectory ? await getClients() : [];

  if (clients.length === 0) {
    redirect("/partner/campaigns");
  }

  return (
    <CampaignForm
      mode="create"
      clients={clients}
      routePrefix="/partner"
    />
  );
}
