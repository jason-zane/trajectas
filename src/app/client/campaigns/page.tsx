import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getCampaigns } from "@/app/actions/campaigns";
import { ClientCampaignList } from "./client-campaign-list";

export default async function ClientCampaignsPage() {
  const { clientId } = await resolveClientOrg("/client/campaigns");

  const campaigns = clientId ? await getCampaigns({ clientId }) : [];

  return <ClientCampaignList campaigns={campaigns} />;
}
