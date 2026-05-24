import { notFound, redirect } from 'next/navigation'
import { getSessionDetail } from '@/app/actions/sessions'
import { getCampaignSessionReportRows } from '@/app/actions/reports'
import { SessionHeaderActions } from '@/components/sessions/session-header-actions'
import { SessionView } from '@/components/results/session-view'

export default async function ClientCampaignSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>
}) {
  const { id: campaignId, sessionId } = await params

  const session = await getSessionDetail(sessionId)
  if (!session) {
    notFound()
  }

  if (session.campaignId !== campaignId) {
    redirect(`/client/campaigns/${session.campaignId}/sessions/${sessionId}`)
  }

  const reportRows = await getCampaignSessionReportRows(sessionId)
  const participantsHref = `/client/campaigns/${campaignId}/participants`

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={false}
      backHref={participantsHref}
      backLabel="Back to participants"
      reportBasePath="/client/reports"
      settingsHref={`/client/campaigns/${campaignId}/settings`}
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/client/campaigns/${campaignId}/overview`}
          participantHref={`/client/campaigns/${campaignId}/participants/${session.participantId}`}
          postDeleteHref={participantsHref}
        />
      }
    />
  )
}
