import { redirect } from "next/navigation";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { getCampaigns } from "@/app/actions/campaigns";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
import { ClientDashboard } from "./client-dashboard";

export default async function ClientDashboardPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/dashboard");
  if (access.status !== "ok") redirect("/unauthorized");

  const orgId = access.activeContext?.tenantId;
  if (!orgId) redirect("/unauthorized");

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
