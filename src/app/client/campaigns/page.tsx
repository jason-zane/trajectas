import Link from "next/link";
import { Plus } from "lucide-react";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import {
  getOperationalCampaignsForClient,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import { getClientAssessmentLibrary } from "@/app/actions/client-entitlements";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { LaunchCampaignButton } from "@/components/campaigns/launch-campaign-button";
import { ClientCampaignList } from "./client-campaign-list";

export default async function ClientCampaignsPage() {
  const { clientId } = await resolveClientOrg("/client/campaigns");

  if (!clientId) {
    return <ClientCampaignList campaigns={[]} />;
  }

  const [campaigns, libraryAssessments] = await Promise.all([
    getOperationalCampaignsForClient(clientId),
    getClientAssessmentLibrary(clientId),
  ]);

  // Map client assessment library entries to the CampaignAssessmentOption shape
  // expected by the QuickLaunchModal's step 2 picker.
  const assessmentsForPicker: CampaignAssessmentOption[] = libraryAssessments.map(
    (a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      status: a.status,
      factorCount: a.factorCount ?? 0,
      sectionCount: a.sectionCount ?? 0,
      totalItemCount: a.totalItemCount ?? 0,
      formatLabel: a.formatMode ?? undefined,
      estimatedDurationMinutes: a.estimatedDurationMinutes ?? 0,
    }),
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description={
          campaigns.length === 0
            ? "No campaigns yet. Quick-launch one to get started."
            : `${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""}.`
        }
      >
        <div className="flex items-center gap-3">
          <LaunchCampaignButton
            label="Launch campaign"
            assessments={assessmentsForPicker}
            clients={[{ id: clientId, name: "My organisation" }]}
            recentCampaigns={campaigns}
            forcedClientId={clientId}
            successHrefPrefix="/client/campaigns"
          />
          <Link
            href="/client/campaigns/create"
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus className="size-4" />
            New Campaign
          </Link>
        </div>
      </PageHeader>
      <ClientCampaignList campaigns={campaigns} />
    </div>
  );
}
