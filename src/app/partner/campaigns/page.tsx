import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getActiveAssessments, getCampaigns } from "@/app/actions/campaigns";
import { getClients } from "@/app/actions/clients";
import { CampaignsTable } from "./campaigns-table";
import { QuickLaunchButton } from "@/components/campaigns/quick-launch-button";

export default async function PartnerCampaignsPage() {
  const [campaigns, assessments, clients] = await Promise.all([
    getCampaigns(),
    getActiveAssessments(),
    getClients(),
  ]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description={`${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""} across your client portfolio.`}
      >
        <div className="flex items-center gap-3">
          <QuickLaunchButton
            assessments={assessments}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            successHrefPrefix="/partner/campaigns"
          />
          <Link
            href="/partner/campaigns/create"
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus className="size-4" />
            New Campaign
          </Link>
        </div>
      </PageHeader>
      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
