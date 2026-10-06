import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
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
  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

  const [deliveryEnabled, managementEnabled, directoryEnabled, feedback360Enabled] = await Promise.all([
    isWorkspaceFeatureEnabled('assessmentDelivery'),
    isWorkspaceFeatureEnabled('campaignManagement'),
    isWorkspaceFeatureEnabled('clientDirectory'),
    isWorkspaceFeatureEnabled('feedback360'),
  ]);
  // This admin launch form needs a permitted client selector. Historical reads
  // remain independently available in selected and support tenant contexts.
  const canLaunch = deliveryEnabled && managementEnabled && directoryEnabled;
  const [campaigns, assessments, clients, actor] = await Promise.all([
    getCampaigns(),
    canLaunch ? getActiveAssessments() : Promise.resolve([]),
    canLaunch ? getClients() : Promise.resolve([]),
    canLaunch ? resolveSessionActor() : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="Deploy assessments to participants and track completion."
      >
        {canLaunch && <div className="flex items-center gap-3">
          <QuickLaunchButton
            assessments={assessments}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            creatorEmail={actor?.email}
            allowLeadership360={feedback360Enabled}
          />
          <Link href="/campaigns/create">
            <Button variant="outline">
              <Plus className="size-4" />
              New Campaign
            </Button>
          </Link>
        </div>}
      </PageHeader>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
