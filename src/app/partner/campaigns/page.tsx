import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
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
      >
        <Link href="/partner/campaigns/create" className={buttonVariants()}>
          <Plus className="size-4" />
          New Campaign
        </Link>
      </PageHeader>
      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
