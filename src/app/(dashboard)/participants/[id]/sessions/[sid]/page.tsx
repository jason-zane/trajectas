import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { SessionHeaderActions } from "@/components/sessions/session-header-actions";
import { SessionView } from "@/components/results/session-view";

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

  const reportRows = await getCampaignSessionReportRows(sessionId);
  const participantHref = `/participants/${participantId}`;

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={true}
      backHref={participantHref}
      backLabel="Back to participant"
      reportBasePath="/reports"
      settingsHref={`/campaigns/${session.campaignId}/settings`}
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/campaigns/${session.campaignId}/overview`}
          participantHref={participantHref}
          postDeleteHref={participantHref}
          canManage
        />
      }
    />
  );
}
