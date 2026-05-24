import { notFound, redirect } from 'next/navigation'
import { getSessionDetail } from '@/app/actions/sessions'
import { getCampaignSessionReportRows } from '@/app/actions/reports'
import { SessionHeaderActions } from '@/components/sessions/session-header-actions'
import { SessionView } from '@/components/results/session-view'

export default async function PartnerCampaignSessionPage({
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
    redirect(`/partner/campaigns/${session.campaignId}/sessions/${sessionId}`)
  }

  const reportRows = await getCampaignSessionReportRows(sessionId)
  const participantsHref = `/partner/campaigns/${campaignId}/participants`

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={false}
      backHref={participantsHref}
      backLabel="Back to participants"
      reportBasePath="/partner/reports"
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/partner/campaigns/${campaignId}/overview`}
          participantHref={`/partner/campaigns/${campaignId}/participants/${session.participantId}`}
          postDeleteHref={participantsHref}
        />
      }
    />
  )
}
