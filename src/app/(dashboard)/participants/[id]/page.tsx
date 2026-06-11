import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { loadTrajectoryForParticipant } from "@/lib/trajectory/load";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";
import { DataTableSkeleton } from "@/components/loading/data-table-skeleton";

async function loadParticipant(participantId: string) {
  try {
    return await getParticipant(participantId);
  } catch (error) {
    console.error("[participant-detail] Failed to load participant:", error);
    return null;
  }
}

// Async component for the slow auxiliary data (sessions, activity, etc.)
async function ParticipantDetailContent({
  id,
  participant,
}: {
  id: string;
  participant: NonNullable<Awaited<ReturnType<typeof loadParticipant>>>;
}) {
  const [sessions, activity, snapshots, trajectory] = await Promise.all([
    getParticipantSessions(id).catch((error) => {
      console.error("[participant-detail] Failed to load sessions:", error);
      return [];
    }),
    getParticipantActivity(id).catch((error) => {
      console.error("[participant-detail] Failed to load activity:", error);
      return [];
    }),
    getReportSnapshotsForParticipant(id).catch((error) => {
      console.error("[participant-detail] Failed to load report snapshots:", error);
      return [];
    }),
    loadTrajectoryForParticipant(id, "participant-detail"),
  ]);

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      trajectory={trajectory}
      backHref="/participants"
      backLabel="Back to participants"
      sessionBaseHref={`/participants/${id}/sessions`}
    />
  );
}

export default async function AdminParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const participant = await loadParticipant(id);

  if (!participant) notFound();

  return (
    <Suspense fallback={<DataTableSkeleton rows={5} columns={3} />}>
      <ParticipantDetailContent id={id} participant={participant} />
    </Suspense>
  );
}
