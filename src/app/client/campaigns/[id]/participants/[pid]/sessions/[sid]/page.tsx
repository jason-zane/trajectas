import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

async function loadSessionDetail(sessionId: string) {
  try {
    return await getSessionDetail(sessionId);
  } catch (error) {
    console.error("[client-session-detail] Failed to load session detail:", error);
    return null;
  }
}

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

  const session = await loadSessionDetail(sessionId);
  if (!session || session.participantId !== pid) notFound();
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
