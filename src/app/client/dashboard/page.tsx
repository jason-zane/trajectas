import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import {
  getCampaigns,
  getCompletionTimeline,
  getFavoriteCampaignIds,
  getOperationalCampaignsForClient,
  getRecentClientResults,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import { getClientAssessmentLibrary } from "@/app/actions/client-entitlements";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { ClientDashboard } from "./client-dashboard";

export default async function ClientDashboardPage() {
  const { clientId } = await resolveClientOrg("/client/dashboard");

  if (!clientId) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader eyebrow="Dashboard" title="Welcome" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No client set up yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your account has been created but no client has been configured.
              Contact your administrator to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [
    campaigns,
    operationalCampaigns,
    recentResults,
    libraryAssessments,
    favoriteCampaignIds,
    completionTimeline,
  ] = await Promise.all([
    getCampaigns({ clientId }),
    getOperationalCampaignsForClient(clientId, { limit: 6 }),
    getRecentClientResults(clientId, { limit: 5 }),
    getClientAssessmentLibrary(clientId),
    getFavoriteCampaignIds(),
    getCompletionTimeline(clientId, { days: 14 }),
  ]);

  const launchAssessments: CampaignAssessmentOption[] = libraryAssessments.map(
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
    <ClientDashboard
      campaigns={campaigns}
      operationalCampaigns={operationalCampaigns}
      recentResults={recentResults}
      launchAssessments={launchAssessments}
      clientId={clientId}
      favoriteCampaignIds={favoriteCampaignIds}
      completionTimeline={completionTimeline}
    />
  );
}
