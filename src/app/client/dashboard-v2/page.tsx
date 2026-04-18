import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import {
  getCampaigns,
  getFavoriteCampaignIds,
  getOperationalCampaignsForClient,
  getRecentClientResults,
  type CampaignAssessmentOption,
} from "@/app/actions/campaigns";
import { getClientAssessmentLibrary } from "@/app/actions/client-entitlements";
import { DashboardV2View } from "./dashboard-v2-view";

export default async function ClientDashboardV2Page() {
  const { clientId } = await resolveClientOrg("/client/dashboard-v2");

  if (!clientId) {
    return (
      <div className="max-w-5xl">
        <p className="text-sm text-muted-foreground">
          No client configured. Contact your administrator.
        </p>
      </div>
    );
  }

  const [
    campaigns,
    operationalCampaigns,
    recentResults,
    libraryAssessments,
    favoriteCampaignIds,
  ] = await Promise.all([
    getCampaigns({ clientId }),
    getOperationalCampaignsForClient(clientId, { limit: 6 }),
    getRecentClientResults(clientId, { limit: 5 }),
    getClientAssessmentLibrary(clientId),
    getFavoriteCampaignIds(),
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
    <DashboardV2View
      campaigns={campaigns}
      operationalCampaigns={operationalCampaigns}
      recentResults={recentResults}
      launchAssessments={launchAssessments}
      clientId={clientId}
      favoriteCampaignIds={favoriteCampaignIds}
    />
  );
}
