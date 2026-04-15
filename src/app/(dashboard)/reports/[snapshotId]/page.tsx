import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { ReportPdfButton } from '@/components/reports/report-pdf-button'
import {
  getReportSnapshot,
  prepareReportSnapshotSendDraft,
} from '@/app/actions/reports'
import { verifyReportAccessToken } from '@/lib/reports/report-access-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapReportSnapshotRow } from '@/lib/supabase/mappers'
import { SendReportButton } from '@/components/reports/send-report-button'
import { RegenerateReportButton } from '@/components/reports/regenerate-report-button'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
  searchParams: Promise<{ reportToken?: string }>
}

async function getSnapshotForReportTokenAccess(
  snapshotId: string,
  reportToken: string,
) {
  const tokenPayload = verifyReportAccessToken(reportToken, snapshotId)
  if (!tokenPayload) {
    return null
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*, participant_sessions(campaign_participant_id)')
    .eq('id', snapshotId)
    .eq('status', 'released')
    .maybeSingle()

  if (error || !data) {
    return null
  }

  const session = Array.isArray(data.participant_sessions)
    ? data.participant_sessions[0]
    : data.participant_sessions

  if (
    !session?.campaign_participant_id ||
    String(session.campaign_participant_id) !== tokenPayload.participantId
  ) {
    return null
  }

  return mapReportSnapshotRow(data)
}

export default async function ReportViewerPage({ params, searchParams }: Props) {
  const { snapshotId } = await params
  const { reportToken } = await searchParams
  const hasTokenAccess = Boolean(reportToken)

  const snapshot = hasTokenAccess
    ? await getSnapshotForReportTokenAccess(snapshotId, reportToken!)
    : await getReportSnapshot(snapshotId)
  if (!snapshot) notFound()
  if (!['ready', 'released'].includes(snapshot.status)) {
    notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]
  const sendDraft =
    !hasTokenAccess
      ? await prepareReportSnapshotSendDraft(snapshotId)
      : null

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <PageHeader
        eyebrow="Reports"
        title="Report Preview"
        description={snapshot.narrativeMode === 'ai_enhanced' ? 'AI enhanced' : 'Report preview'}
      >
        <div className="flex items-center gap-2">
          {sendDraft ? (
            <SendReportButton
              snapshotId={snapshotId}
              draft={sendDraft}
              alreadySent={snapshot.status === 'released'}
            />
          ) : null}
          <ReportPdfButton
            snapshotId={snapshotId}
            initialPdfUrl={snapshot.pdfUrl}
            initialPdfStatus={snapshot.pdfStatus}
            reportToken={reportToken}
            variant="outline"
          />
        </div>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
