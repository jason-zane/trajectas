import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id: participantId, sid: sessionId } = await params;

  const [session, templates] = await Promise.all([
    getSessionDetail(sessionId),
    getActiveReportTemplates(),
  ]);

  if (!session || session.participantId !== participantId) {
    notFound();
  }

  return (
    <SessionDetailView
      session={session}
      templates={templates}
      canSeeResponses={true}
      backHref={`/participants/${participantId}`}
      backLabel="Back to participant"
    />
  );
}
