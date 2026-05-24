import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { SessionHeaderActions } from "@/components/sessions/session-header-actions";
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
  const participantHref = `/partner/campaigns/${campaignId}/participants/${participantId}`;

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={false}
      backHref={participantHref}
      backLabel="Back to participant"
      reportBasePath="/partner/reports"
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/partner/campaigns/${campaignId}/overview`}
          participantHref={participantHref}
          postDeleteHref={participantHref}
        />
      }
    />
  );
}
