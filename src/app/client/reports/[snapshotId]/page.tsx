import { ReportPreviewSurface } from '@/components/reports/report-preview-surface'
import { ReferenceStatusNotice } from '@/components/reports/reference-status-notice'
import { requireReportSnapshotReadAccess, canManageCampaign } from '@/lib/auth/authorization'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { ReportPdfButton } from '@/components/reports/report-pdf-button'
import { getReportSnapshot } from '@/app/actions/reports'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
}

export default async function ClientReportViewerPage({ params }: Props) {
  if (!await isWorkspaceFeatureEnabled('reportViewing')) return <WorkspaceFeatureUnavailable feature="reportViewing" />

  const { snapshotId } = await params
  const snapshot = await getReportSnapshot(snapshotId)
  if (!snapshot) notFound()
  if (!snapshot.releasedAt) {
    // Preserve released-only behaviour for legacy reports. Existing authorization
    // explicitly allows manager draft preview; scope this extension to a new
    // manager-requested edition and recheck the exact campaign's manage gate.
    if (snapshot.generationIntent !== 'manager_requested' || snapshot.status !== 'ready') notFound()
    const access = await requireReportSnapshotReadAccess(snapshotId)
    if (!canManageCampaign(access.scope, access.partnerId, access.clientId)) notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      <div className="flex justify-end">
        <ReportPdfButton
          snapshotId={snapshotId}
          initialPdfUrl={snapshot.pdfUrl}
          initialPdfStatus={snapshot.pdfStatus}
          variant="outline"
        />
      </div>
      <ReferenceStatusNotice snapshot={snapshot} />
      <ReportPreviewSurface blocks={blocks}>
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </ReportPreviewSurface>
    </div>
  )
}
