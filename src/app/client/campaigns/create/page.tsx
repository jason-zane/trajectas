import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";

export default async function ClientCreateCampaignPage() {
  const { orgId } = await resolveClientOrg("/client/campaigns/create");

  return (
    <CampaignForm
      mode="create"
      defaultOrganizationId={orgId}
      routePrefix="/client"
    />
  );
}
