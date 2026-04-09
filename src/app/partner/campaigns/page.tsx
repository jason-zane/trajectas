import { PageHeader } from "@/components/page-header";
import { getCampaigns } from "@/app/actions/campaigns";
import { CampaignsTable } from "./campaigns-table";

export default async function PartnerCampaignsPage() {
  const campaigns = await getCampaigns();
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description={`${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} across your client portfolio.`}
      />
      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
