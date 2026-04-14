import { notFound, redirect } from 'next/navigation'
import { getSessionDetail } from '@/app/actions/sessions'
import { getCampaignSessionReportRows } from '@/app/actions/reports'
import { CampaignSessionView } from '@/components/results/campaign-session-view'

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

  return (
    <CampaignSessionView
      session={session}
      reportRows={reportRows}
      backHref={`/partner/campaigns/${campaignId}/results`}
      backLabel="Back to results"
      reportBasePath="/partner/reports"
    />
  )
}
