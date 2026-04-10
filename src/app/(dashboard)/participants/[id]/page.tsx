import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";

export default async function AdminParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [participant, sessions, activity, snapshots] = await Promise.all([
    getParticipant(id),
    getParticipantSessions(id),
    getParticipantActivity(id),
    getReportSnapshotsForParticipant(id),
  ]);

  if (!participant) notFound();

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
