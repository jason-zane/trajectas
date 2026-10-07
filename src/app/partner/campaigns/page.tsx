
import { WorkspaceFeatureVisibility } from '@/components/workspace-feature-visibility'
import { getEffectiveWorkspaceFeatures } from '@/lib/dal/workspace-features';
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import Link from "next/link";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button-variants";
import { getActiveAssessments, getCampaigns } from "@/app/actions/campaigns";
import { resolveSessionActor } from "@/lib/auth/actor";
import { getClients } from "@/app/actions/clients";
import { CampaignsTable } from "./campaigns-table";
import { QuickLaunchButton } from "@/components/campaigns/quick-launch-button";

export default async function PartnerCampaignsPage() {
  const features = await getEffectiveWorkspaceFeatures();
  if (!await isWorkspaceFeatureEnabled('campaignViewing')) return <WorkspaceFeatureUnavailable feature="campaignViewing" />

  const [campaigns, assessments, clients, actor] = await Promise.all([
    getCampaigns(),
    features.assessmentDelivery ? getActiveAssessments() : Promise.resolve([]),
    features.clientDirectory ? getClients() : Promise.resolve([]),
    resolveSessionActor(),
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
            creatorEmail={actor?.email}
            assessments={assessments}
            clients={clients.map((c) => ({ id: c.id, name: c.name }))}
            successHrefPrefix="/partner/campaigns"
          />
          <WorkspaceFeatureVisibility features={["campaignManagement","assessmentDelivery"]}><Link
            href="/partner/campaigns/create"
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus className="size-4" />
            New Campaign
          </Link></WorkspaceFeatureVisibility>
        </div>
      </PageHeader>
      {campaigns.length === 0 ? (
        <EmptyState
          eyebrow="Campaigns"
          title="No campaigns yet"
          description="Launch a campaign for one of your clients to start inviting participants."
          actionLabel="New campaign"
          actionHref="/partner/campaigns/create"
        />
      ) : (
        <CampaignsTable campaigns={campaigns} />
      )}
    </div>
  );
}
