import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";

import {
  getOperationalCampaignsForClient,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import { getClientAssessmentLibrary } from "@/app/actions/client-entitlements";
import { LaunchCampaignButton } from "@/components/campaigns/launch-campaign-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";

import { AssessmentLibraryTable } from "./assessment-library-table";

export default async function ClientAssessmentsPage() {
  const { clientId } = await resolveClientOrg("/client/assessments");
  if (!clientId) {
    redirect("/client/dashboard");
  }

  const [assessments, reusableCampaigns] = await Promise.all([
    getClientAssessmentLibrary(clientId),
    getOperationalCampaignsForClient(clientId, { limit: 8 }),
  ]);

  const assessmentsForPicker: CampaignAssessmentOption[] = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    status: a.status,
    factorCount: a.factorCount ?? 0,
    sectionCount: a.sectionCount ?? 0,
    totalItemCount: a.totalItemCount ?? 0,
    formatLabel: a.formatMode ?? undefined,
    estimatedDurationMinutes: a.estimatedDurationMinutes ?? 0,
  }));

  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Assessments"
        title="Assessment library"
        description={`${assessments.length} assessment${assessments.length === 1 ? "" : "s"} available to launch in your campaigns.`}
      >
        <div className="flex items-center gap-3">
          <LaunchCampaignButton
            assessments={assessmentsForPicker}
            clients={[{ id: clientId, name: "My organisation" }]}
            recentCampaigns={reusableCampaigns}
            forcedClientId={clientId}
            successHrefPrefix="/client/campaigns"
          />
          <Link href="/client/campaigns/create">
            <Button variant="outline">
              <Plus className="size-4" />
              New Campaign
            </Button>
          </Link>
        </div>
      </PageHeader>

      <AssessmentLibraryTable assessments={assessments} />
    </div>
  );
}
