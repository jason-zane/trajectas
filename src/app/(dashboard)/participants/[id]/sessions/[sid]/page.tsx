import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { resolveAuthorizedScope } from "@/lib/auth/authorization";
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

  const [reportRows, scope] = await Promise.all([
    getCampaignSessionReportRows(sessionId),
    resolveAuthorizedScope(),
  ]);
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
      isPlatformAdmin={scope.isPlatformAdmin}
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/campaigns/${session.campaignId}/overview`}
          participantHref={participantHref}
          postDeleteHref={participantHref}
          canManage
          compareParticipantId={session.participantId}
          comparePath="/participants/compare"
        />
      }
    />
  );
}
