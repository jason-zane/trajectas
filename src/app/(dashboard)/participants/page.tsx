import { PageHeader } from "@/components/page-header";
import { getParticipants, getUniqueParticipants } from "@/app/actions/participants";
import { ParticipantsTable } from "./participants-table";

export default async function ParticipantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = params.view === "sessions" ? "sessions" : "participants";

  const [sessionsResult, participantsResult] = await Promise.all([
    view === "sessions" ? getParticipants() : Promise.resolve(null),
    view === "participants" ? getUniqueParticipants() : Promise.resolve(null),
  ]);

  const total = view === "sessions"
    ? (sessionsResult?.total ?? 0)
    : (participantsResult?.total ?? 0);

  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Participants"
        title="Participants"
        description={`${total} ${view === "participants" ? "participant" : "session"}${total !== 1 ? "s" : ""} across all campaigns.`}
      />

      <ParticipantsTable
        view={view}
        sessions={sessionsResult?.data ?? []}
        participants={participantsResult?.data ?? []}
      />
    </div>
  );
}
