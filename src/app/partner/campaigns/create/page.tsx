import { redirect } from "next/navigation";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";
import { getClients } from "@/app/actions/clients";

export default async function PartnerCreateCampaignPage() {
  const clients = await getClients();

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
