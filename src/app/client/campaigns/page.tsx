import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { redirect } from "next/navigation";
import { getCampaigns } from "@/app/actions/campaigns";
import { ClientCampaignList } from "./client-campaign-list";

export default async function ClientCampaignsPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/campaigns");
  if (access.status !== "ok") redirect("/unauthorized");

  const orgId = access.activeContext?.tenantId;
  if (!orgId) redirect("/unauthorized");

  const campaigns = await getCampaigns();

  return <ClientCampaignList campaigns={campaigns} />;
}
