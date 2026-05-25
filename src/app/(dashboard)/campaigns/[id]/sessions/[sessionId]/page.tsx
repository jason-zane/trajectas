import { notFound, redirect } from 'next/navigation'
import { getSessionDetail } from '@/app/actions/sessions'
import { getCampaignSessionReportRows } from '@/app/actions/reports'
import { resolveAuthorizedScope } from '@/lib/auth/authorization'
import { SessionHeaderActions } from '@/components/sessions/session-header-actions'
import { SessionView } from '@/components/results/session-view'

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

  const [reportRows, scope] = await Promise.all([
    getCampaignSessionReportRows(sessionId),
    resolveAuthorizedScope(),
  ])
  const participantsHref = `/campaigns/${campaignId}/participants`

  return (
    <SessionView
      session={session}
      reportRows={reportRows}
      canSeeResponses={true}
      backHref={participantsHref}
      backLabel="Back to participants"
      reportBasePath="/reports"
      settingsHref={`/campaigns/${campaignId}/settings`}
      isPlatformAdmin={scope.isPlatformAdmin}
      actions={
        <SessionHeaderActions
          sessionId={sessionId}
          campaignHref={`/campaigns/${campaignId}/overview`}
          participantHref={`/campaigns/${campaignId}/participants/${session.participantId}`}
          postDeleteHref={participantsHref}
          canManage
          compareParticipantId={session.participantId}
          comparePath={`/campaigns/${campaignId}/compare`}
        />
      }
    />
  )
}
