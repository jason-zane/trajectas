import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { SessionHeaderActions } from "@/components/sessions/session-header-actions";
import { SessionView } from "@/components/results/session-view";

export default async function ClientSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string; sid: string }>;
}) {
  const { id: campaignId, pid, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) notFound();
  if (session.participantId !== pid || session.campaignId !== campaignId) {
    redirect(`/client/campaigns/${session.campaignId}/participants/${session.participantId}/sessions/${sessionId}`);
  }

  const reportRows = await getCampaignSessionReportRows(sessionId);
  const participantHref = `/client/campaigns/${campaignId}/participants/${pid}`;

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={false}
      backHref={participantHref}
      backLabel="Back to participant"
      reportBasePath="/client/reports"
      settingsHref={`/client/campaigns/${campaignId}/settings`}
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/client/campaigns/${campaignId}/overview`}
          participantHref={participantHref}
          postDeleteHref={participantHref}
          compareParticipantId={session.participantId}
          comparePath={`/client/campaigns/${campaignId}/compare`}
        />
      }
    />
  );
}
