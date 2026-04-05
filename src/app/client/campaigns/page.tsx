import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getCampaigns } from "@/app/actions/campaigns";
import { ClientCampaignList } from "./client-campaign-list";

export default async function ClientCampaignsPage() {
  const { orgId } = await resolveClientOrg("/client/campaigns");

  const campaigns = orgId ? await getCampaigns() : [];

  return <ClientCampaignList campaigns={campaigns} />;
}
