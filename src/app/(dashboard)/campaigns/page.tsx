import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getCampaigns } from "@/app/actions/campaigns";
import { CampaignsTable } from "./campaigns-table";

export default async function CampaignsPage() {
  const campaigns = await getCampaigns();

  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="Deploy assessments to participants and track completion."
      >
        <Link href="/campaigns/create">
          <Button>
            <Plus className="size-4" />
            New Campaign
          </Button>
        </Link>
      </PageHeader>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
