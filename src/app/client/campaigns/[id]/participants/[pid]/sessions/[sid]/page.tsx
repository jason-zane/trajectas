import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

async function loadTemplates() {
  try {
    return await getActiveReportTemplates();
  } catch (error) {
    console.error("[client-session-detail] Failed to load report templates:", error);
    return [];
  }
}

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
  const templates = await loadTemplates();

  return (
    <SessionDetailView
      session={session}
      templates={templates}
      canSeeResponses={false}
      backHref={`/client/campaigns/${campaignId}/participants/${pid}`}
      backLabel="Back to participant"
    />
  );
}
