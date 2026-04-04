import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getParticipantsForOrganization, getCampaigns } from "@/app/actions/campaigns";
import { GlobalParticipants } from "./global-participants";

export default async function ClientParticipantsPage() {
  const { orgId } = await resolveClientOrg("/client/participants");

  const [participants, campaigns] = await Promise.all([
    getParticipantsForOrganization(orgId),
    getCampaigns(),
  ]);

  return <GlobalParticipants participants={participants} campaigns={campaigns} />;
}
