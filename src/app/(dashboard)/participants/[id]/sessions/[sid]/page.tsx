import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

async function loadTemplates() {
  try {
    return await getActiveReportTemplates();
  } catch (error) {
    console.error("[session-detail] Failed to load report templates:", error);
    return [];
  }
}

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
  const templates = await loadTemplates();

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
