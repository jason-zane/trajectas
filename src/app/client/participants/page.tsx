import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { redirect } from "next/navigation";
import { getParticipantsForOrganization } from "@/app/actions/campaigns";
import { getCampaigns } from "@/app/actions/campaigns";
import { GlobalParticipants } from "./global-participants";

export default async function ClientParticipantsPage() {
  const access = await resolveWorkspaceAccess("client");
  if (access.status === "signed_out") redirect("/login?next=/client/participants");
  if (access.status !== "ok") redirect("/unauthorized");

  const orgId = access.activeContext?.tenantId;
  if (!orgId) redirect("/unauthorized");

  const [participants, campaigns] = await Promise.all([
    getParticipantsForOrganization(orgId),
    getCampaigns(),
  ]);

  return <GlobalParticipants participants={participants} campaigns={campaigns} />;
}
