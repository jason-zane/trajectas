import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function ClientSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string; sid: string }>;
}) {
  const { id: campaignId, pid, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session || session.participantId !== pid) notFound();
  const templates = await getActiveReportTemplates();

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
