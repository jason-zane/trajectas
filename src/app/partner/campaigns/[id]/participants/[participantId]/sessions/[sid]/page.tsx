import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function PartnerSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string; sid: string }>;
}) {
  const { id: campaignId, participantId, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) notFound();
  if (session.participantId !== participantId) {
    redirect(`/partner/campaigns/${campaignId}/participants/${session.participantId}/sessions/${sessionId}`);
  }
  return (
    <SessionDetailView
      session={session}
      canSeeResponses={false}
      backHref={`/partner/campaigns/${campaignId}/participants/${participantId}`}
      backLabel="Back to participant"
    />
  );
}
