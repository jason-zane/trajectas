import { notFound } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getActiveReportTemplates } from "@/app/actions/reports";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function PartnerSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string; sid: string }>;
}) {
  const { id: campaignId, participantId, sid: sessionId } = await params;

  const [session, templates] = await Promise.all([
    getSessionDetail(sessionId),
    getActiveReportTemplates(),
  ]);

  if (!session || session.participantId !== participantId) notFound();

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
