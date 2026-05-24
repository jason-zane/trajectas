import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { SessionView } from "@/components/results/session-view";

export default async function PartnerSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; participantId: string; sid: string }>;
}) {
  const { id: campaignId, participantId, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) notFound();
  if (session.participantId !== participantId || session.campaignId !== campaignId) {
    redirect(`/partner/campaigns/${session.campaignId}/participants/${session.participantId}/sessions/${sessionId}`);
  }

  const reportRows = await getCampaignSessionReportRows(sessionId);

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={false}
      backHref={`/partner/campaigns/${campaignId}/participants/${participantId}`}
      backLabel="Back to participant"
      reportBasePath="/partner/reports"
    />
  );
}
