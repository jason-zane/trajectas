import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getReportSnapshot } from '@/app/actions/reports'
import { verifyReportPdfToken } from '@/lib/reports/pdf-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapReportSnapshotRow } from '@/lib/supabase/mappers'
import { ReleaseSnapshotButton } from './release-snapshot-button'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
  searchParams: Promise<{ format?: string; pdfToken?: string }>
}

async function getSnapshotForPdfRender(snapshotId: string) {
  const db = createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data ? mapReportSnapshotRow(data) : null
}

export default async function ReportViewerPage({ params, searchParams }: Props) {
  const { snapshotId } = await params
  const { format, pdfToken } = await searchParams
  const isPrint = format === 'print'
  const canBypassAuthForPdf = isPrint && verifyReportPdfToken(pdfToken, snapshotId)

  const snapshot = canBypassAuthForPdf
    ? await getSnapshotForPdfRender(snapshotId)
    : await getReportSnapshot(snapshotId)
  if (!snapshot) notFound()
  if (!['ready', 'released'].includes(snapshot.status)) notFound()

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  if (isPrint) {
    return (
      <div className="p-0">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <PageHeader
        eyebrow="Reports"
        title="Report Preview"
        description={`${snapshot.audienceType} audience · ${snapshot.narrativeMode}`}
      >
        <div className="flex items-center gap-2">
          {snapshot.status === 'ready' && (
            <ReleaseSnapshotButton snapshotId={snapshotId} />
          )}
          <a href={`/api/reports/${snapshotId}/pdf`}>
            <Button variant="outline">
              <Download className="size-4" />
              Generate PDF
            </Button>
          </a>
        </div>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-sm p-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
