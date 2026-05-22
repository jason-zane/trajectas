import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { getCampaignSessionReportRows } from "@/app/actions/reports";
import { SessionView } from "@/components/results/session-view";

export default async function CampaignParticipantSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; pid: string; sid: string }>;
}) {
  const { id: campaignId, pid, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) {
    notFound();
  }
  if (session.participantId !== pid || session.campaignId !== campaignId) {
    redirect(`/campaigns/${session.campaignId}/participants/${session.participantId}/sessions/${sessionId}`);
  }

  const reportRows = await getCampaignSessionReportRows(sessionId);

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={true}
      backHref={`/campaigns/${campaignId}/participants/${pid}`}
      backLabel="Back to participant"
      reportBasePath="/reports"
      settingsHref={`/campaigns/${campaignId}/settings`}
    />
  );
}
