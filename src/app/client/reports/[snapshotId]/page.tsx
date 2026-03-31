import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getReportSnapshot } from '@/app/actions/reports'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
}

export default async function ClientReportViewerPage({ params }: Props) {
  const { snapshotId } = await params
  const snapshot = await getReportSnapshot(snapshotId)
  if (!snapshot || !snapshot.releasedAt || snapshot.audienceType !== 'hr_manager') {
    notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      {snapshot.pdfUrl && (
        <div className="flex justify-end">
          <a href={snapshot.pdfUrl} download>
            <Button variant="outline">
              <Download className="size-4" />
              Download PDF
            </Button>
          </a>
        </div>
      )}
      <div className="rounded-xl border border-border bg-card shadow-sm p-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
