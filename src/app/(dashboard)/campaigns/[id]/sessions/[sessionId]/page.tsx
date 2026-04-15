import { notFound, redirect } from 'next/navigation'
import { getSessionDetail } from '@/app/actions/sessions'
import { getCampaignSessionReportRows } from '@/app/actions/reports'
import { CampaignSessionView } from '@/components/results/campaign-session-view'

export default async function CampaignSessionPage({
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
    redirect(`/campaigns/${session.campaignId}/sessions/${sessionId}`)
  }

  const reportRows = await getCampaignSessionReportRows(sessionId)

  return (
    <CampaignSessionView
      session={session}
      reportRows={reportRows}
      backHref={`/campaigns/${campaignId}/participants`}
      backLabel="Back to participants"
      reportBasePath="/reports"
      settingsHref={`/campaigns/${campaignId}/settings`}
    />
  )
}
