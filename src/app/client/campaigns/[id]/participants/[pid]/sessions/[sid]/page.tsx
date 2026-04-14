import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function ClientSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string; sid: string }>;
}) {
  const { id: campaignId, pid, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) notFound();
  if (session.participantId !== pid) {
    redirect(`/client/campaigns/${campaignId}/participants/${session.participantId}/sessions/${sessionId}`);
  }
  return (
    <SessionDetailView
      session={session}
      canSeeResponses={false}
      backHref={`/client/campaigns/${campaignId}/participants/${pid}`}
      backLabel="Back to participant"
    />
  );
}
