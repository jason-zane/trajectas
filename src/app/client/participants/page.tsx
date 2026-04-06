import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getParticipantsForClient, getCampaigns } from "@/app/actions/campaigns";
import { GlobalParticipants } from "./global-participants";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

export default async function ClientParticipantsPage() {
  const { clientId } = await resolveClientOrg("/client/participants");

  if (!clientId) {
    return (
      <div className="space-y-6 max-w-5xl">
        <PageHeader eyebrow="Participants" title="All Participants" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-muted mb-4">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No client configured yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [participants, campaigns] = await Promise.all([
    getParticipantsForClient(clientId),
    getCampaigns(),
  ]);

  return <GlobalParticipants participants={participants} campaigns={campaigns} />;
}
