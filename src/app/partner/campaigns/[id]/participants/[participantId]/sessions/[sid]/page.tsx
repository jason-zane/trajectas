import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

async function loadTemplates() {
  try {
    return await getActiveReportTemplates();
  } catch (error) {
    console.error("[partner-session-detail] Failed to load report templates:", error);
    return [];
  }
}

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
  const templates = await loadTemplates();

  return (
    <SessionDetailView
      session={session}
      templates={templates}
      canSeeResponses={false}
      backHref={`/partner/campaigns/${campaignId}/participants/${participantId}`}
      backLabel="Back to participant"
    />
  );
}
