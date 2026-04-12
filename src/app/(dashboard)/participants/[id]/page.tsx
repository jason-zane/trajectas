import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";

async function loadParticipant(participantId: string) {
  try {
    return await getParticipant(participantId);
  } catch (error) {
    console.error("[participant-detail] Failed to load participant:", error);
    return null;
  }
}

async function loadParticipantAuxiliaryData(participantId: string) {
  const [sessions, activity, snapshots] = await Promise.all([
    getParticipantSessions(participantId).catch((error) => {
      console.error("[participant-detail] Failed to load sessions:", error);
      return [];
    }),
    getParticipantActivity(participantId).catch((error) => {
      console.error("[participant-detail] Failed to load activity:", error);
      return [];
    }),
    getReportSnapshotsForParticipant(participantId).catch((error) => {
      console.error("[participant-detail] Failed to load report snapshots:", error);
      return [];
    }),
  ]);

  return { sessions, activity, snapshots };
}

export default async function AdminParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const participant = await loadParticipant(id);

  if (!participant) notFound();

  const { sessions, activity, snapshots } = await loadParticipantAuxiliaryData(id);

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref="/participants"
      backLabel="Back to participants"
      sessionBaseHref={`/participants/${id}/sessions`}
    />
  );
}
