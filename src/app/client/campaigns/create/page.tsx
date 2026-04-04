import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { redirect } from "next/navigation";
import { CampaignForm } from "@/app/(dashboard)/campaigns/campaign-form";

export default async function ClientCreateCampaignPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/campaigns/create");
  if (access.status !== "ok") redirect("/unauthorized");

  const orgId = access.activeContext?.tenantId;
  if (!orgId) redirect("/unauthorized");

  return (
    <CampaignForm
      mode="create"
      defaultOrganizationId={orgId}
      routePrefix="/client"
    />
  );
}
