import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getCampaigns } from "@/app/actions/campaigns";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
import { ClientDashboard } from "./client-dashboard";

export default async function ClientDashboardPage() {
  const { orgId } = await resolveClientOrg("/client/dashboard");

  const [campaigns, assignments] = await Promise.all([
    getCampaigns(),
    getAssessmentAssignments(orgId),
  ]);

  return (
    <ClientDashboard
      campaigns={campaigns}
      assessmentAssignments={assignments}
    />
  );
}
