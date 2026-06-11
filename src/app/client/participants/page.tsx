import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { getParticipantsForClient, getUniqueParticipantsForClientPaginated, getCampaigns } from "@/app/actions/campaigns";
import { GlobalParticipants } from "./global-participants";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Users } from "lucide-react";

const PAGE_SIZE = 50;

export default async function ClientParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const params = await searchParams;
  const view = params.view === "sessions" ? "sessions" : "participants";
  const page = Math.max(0, parseInt(String(params.page ?? "0"), 10));
  const query = String(params.q ?? "").trim();

  const [sessions, paginationResult, campaigns] = await Promise.all([
    view === "sessions" ? getParticipantsForClient(clientId) : Promise.resolve([]),
    view === "participants"
      ? getUniqueParticipantsForClientPaginated(clientId, page, PAGE_SIZE, query)
      : Promise.resolve({ participants: [], totalCount: 0, page, pageSize: PAGE_SIZE }),
    getCampaigns({ clientId }),
  ]);

  return (
    <GlobalParticipants
      view={view}
      sessions={sessions}
      participants={paginationResult.participants}
      campaigns={campaigns}
      paginationMeta={{
        page: paginationResult.page,
        pageSize: paginationResult.pageSize,
        totalCount: paginationResult.totalCount,
        query,
      }}
    />
  );
}
