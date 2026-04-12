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
    console.error("[partner-participant-detail] Failed to load participant:", error);
    return null;
  }
}

async function loadParticipantAuxiliaryData(participantId: string) {
  const [sessions, activity, snapshots] = await Promise.all([
    getParticipantSessions(participantId).catch((error) => {
      console.error("[partner-participant-detail] Failed to load sessions:", error);
      return [];
    }),
    getParticipantActivity(participantId).catch((error) => {
      console.error("[partner-participant-detail] Failed to load activity:", error);
      return [];
    }),
    getReportSnapshotsForParticipant(participantId).catch((error) => {
      console.error("[partner-participant-detail] Failed to load report snapshots:", error);
      return [];
    }),
  ]);

  return { sessions, activity, snapshots };
}

export default async function PartnerParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string }>;
}) {
  const { id: campaignId, participantId } = await params;

  const participant = await loadParticipant(participantId);

  if (!participant) notFound();

  const { sessions, activity, snapshots } = await loadParticipantAuxiliaryData(participantId);

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref={`/partner/campaigns/${campaignId}`}
      backLabel="Back to campaign"
      sessionBaseHref={`/partner/campaigns/${campaignId}/participants/${participantId}/sessions`}
    />
  );
}
