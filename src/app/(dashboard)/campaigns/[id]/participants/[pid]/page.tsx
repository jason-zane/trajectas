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
    console.error("[campaign-participant-detail] Failed to load participant:", error);
    return null;
  }
}

async function loadParticipantAuxiliaryData(participantId: string) {
  const [sessions, activity, snapshots] = await Promise.all([
    getParticipantSessions(participantId).catch((error) => {
      console.error("[campaign-participant-detail] Failed to load sessions:", error);
      return [];
    }),
    getParticipantActivity(participantId).catch((error) => {
      console.error("[campaign-participant-detail] Failed to load activity:", error);
      return [];
    }),
    getReportSnapshotsForParticipant(participantId).catch((error) => {
      console.error("[campaign-participant-detail] Failed to load report snapshots:", error);
      return [];
    }),
  ]);

  return { sessions, activity, snapshots };
}

export default async function CampaignParticipantDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string }>;
}) {
  const { id: campaignId, pid } = await params;

  const participant = await loadParticipant(pid);
  if (!participant || participant.campaignId !== campaignId) {
    notFound();
  }

  const { sessions, activity, snapshots } = await loadParticipantAuxiliaryData(pid);

  return (
    <ParticipantDetailView
      participant={participant}
      sessions={sessions}
      activity={activity}
      snapshots={snapshots}
      backHref={`/campaigns/${campaignId}/participants`}
      backLabel="Back to participants"
      sessionBaseHref={`/campaigns/${campaignId}/participants/${pid}/sessions`}
    />
  );
}
