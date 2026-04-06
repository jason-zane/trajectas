import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";

export default async function ClientCreateCampaignPage() {
  const { clientId } = await resolveClientOrg("/client/campaigns/create");
  if (!clientId) redirect("/client/dashboard");

  return (
    <CampaignForm
      mode="create"
      defaultClientId={clientId}
      routePrefix="/client"
    />
  );
}
