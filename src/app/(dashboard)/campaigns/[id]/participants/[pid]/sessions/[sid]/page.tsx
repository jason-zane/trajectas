import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function CampaignParticipantSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string; sid: string }>;
}) {
  const { id: campaignId, pid, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) {
    notFound();
  }
  if (session.participantId !== pid || session.campaignId !== campaignId) {
    redirect(`/campaigns/${session.campaignId}/participants/${session.participantId}/sessions/${sessionId}`);
  }

  return (
    <SessionDetailView
      session={session}
      canSeeResponses={true}
      backHref={`/campaigns/${campaignId}/participants/${pid}`}
      backLabel="Back to participant"
    />
  );
}
