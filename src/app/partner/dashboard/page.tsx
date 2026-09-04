import { Building2 } from "lucide-react";

import {
  getActiveAssessments,
  getCampaigns,
  getFavoriteCampaignIds,
} from "@/app/actions/campaigns";
import { getClients } from "@/app/actions/clients";
import { getPartnerDashboardData } from "@/app/actions/partner-dashboard";
import { getPartnerAssessmentAssignments } from "@/app/actions/partner-entitlements";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getPartnerName } from "@/lib/dal/partners";
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org";
import { PartnerDashboard } from "./partner-dashboard";

export default async function PartnerDashboardPage() {
  const { partnerId } = await resolvePartnerOrg("/partner/dashboard");

  if (!partnerId) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader eyebrow="Dashboard" title="Welcome" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No partner set up yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Your account has been created but no partner organisation has been
              configured. Contact Trajectas to get started.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [
    clients,
    campaigns,
    allocation,
    launchAssessments,
    favoriteCampaignIds,
    { completionTimeline, recentResults },
    partnerName,
  ] = await Promise.all([
    getClients(),
    getCampaigns(),
    getPartnerAssessmentAssignments(partnerId),
    getActiveAssessments(),
    getFavoriteCampaignIds(),
    getPartnerDashboardData(partnerId),
    getPartnerName(partnerId),
  ]);

  return (
    <PartnerDashboard
      partnerName={partnerName ?? "your partner organisation"}
      clients={clients}
      campaigns={campaigns}
      allocation={allocation}
      launchAssessments={launchAssessments}
      recentResults={recentResults}
      favoriteCampaignIds={favoriteCampaignIds}
      completionTimeline={completionTimeline}
    />
  );
}
