import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getCampaigns } from "@/app/actions/campaigns";
import { ClientCampaignList } from "./client-campaign-list";

export default async function ClientCampaignsPage() {
  await resolveClientOrg("/client/campaigns");

  const campaigns = await getCampaigns();

  return <ClientCampaignList campaigns={campaigns} />;
}
