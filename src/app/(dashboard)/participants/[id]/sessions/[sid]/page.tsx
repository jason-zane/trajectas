import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { SessionActionsMenu } from "@/components/sessions/session-actions-menu";
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <SessionActionsMenu sessionId={sessionId} />
      </div>
      <SessionView
        session={session}
        reportRows={reportRows}
        canSeeResponses={true}
        backHref={`/participants/${participantId}`}
        backLabel="Back to participant"
        reportBasePath="/reports"
        settingsHref={`/campaigns/${session.campaignId}/settings`}
      />
    </div>
  );
}
