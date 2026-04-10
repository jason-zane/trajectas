import { notFound } from "next/navigation";
import {
  getParticipant,
  getParticipantSessions,
  getParticipantActivity,
} from "@/app/actions/participants";
import { getReportSnapshotsForParticipant } from "@/app/actions/reports";
import { ParticipantDetailView } from "@/components/results/participant-detail-view";

export default async function ClientParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id: campaignId, pid } = await params;

  const [participant, sessions, activity, snapshots] = await Promise.all([
    getParticipant(pid),
    getParticipantSessions(pid),
    getParticipantActivity(pid),
    getReportSnapshotsForParticipant(pid),
  ]);

  if (!participant) notFound();

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref={`/client/campaigns/${campaignId}`}
      backLabel="Back to campaign"
      sessionBaseHref={`/client/campaigns/${campaignId}/participants/${pid}/sessions`}
    />
  );
}
