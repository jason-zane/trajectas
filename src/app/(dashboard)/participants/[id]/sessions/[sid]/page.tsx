import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id: participantId, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) {
    notFound();
  }
  if (session.participantId !== participantId) {
    redirect(`/participants/${session.participantId}/sessions/${sessionId}`);
  }
  return (
    <SessionDetailView
      session={session}
      canSeeResponses={true}
      backHref={`/participants/${participantId}`}
      backLabel="Back to participant"
    />
  );
}
