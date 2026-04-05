import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";

export default async function ClientCreateCampaignPage() {
  const { orgId } = await resolveClientOrg("/client/campaigns/create");
  if (!orgId) redirect("/client/dashboard");

  return (
    <CampaignForm
      mode="create"
      defaultOrganizationId={orgId}
      routePrefix="/client"
    />
  );
}
