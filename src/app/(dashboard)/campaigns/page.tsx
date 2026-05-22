import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { getActiveAssessments, getCampaigns } from "@/app/actions/campaigns";
import { resolveSessionActor } from "@/lib/auth/actor";
import { getClients } from "@/app/actions/clients";
import { CampaignsTable } from "./campaigns-table";
import { QuickLaunchButton } from "@/components/campaigns/quick-launch-button";

export default async function CampaignsPage() {
  const [campaigns, assessments, clients, actor] = await Promise.all([
    getCampaigns(),
    getActiveAssessments(),
    getClients(),
    resolveSessionActor(),
  ]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="Deploy assessments to participants and track completion."
      >
        <div className="flex items-center gap-3">
          <QuickLaunchButton
            assessments={assessments}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            creatorEmail={actor?.email}
          />
          <Link href="/campaigns/create">
            <Button variant="outline">
              <Plus className="size-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </PageHeader>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
