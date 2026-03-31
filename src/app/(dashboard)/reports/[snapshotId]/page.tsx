import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getReportSnapshot } from '@/app/actions/reports'
import { ReleaseSnapshotButton } from './release-snapshot-button'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
  searchParams: Promise<{ format?: string }>
}

export default async function ReportViewerPage({ params, searchParams }: Props) {
  const { snapshotId } = await params
  const { format } = await searchParams
  const isPrint = format === 'print'

  const snapshot = await getReportSnapshot(snapshotId)
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
          {snapshot.pdfUrl && (
            <a href={snapshot.pdfUrl} download>
              <Button variant="outline">
                <Download className="size-4" />
                Download PDF
              </Button>
            </a>
          )}
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
