import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { ArrowLeft } from 'lucide-react'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { ReportPdfButton } from '@/components/reports/report-pdf-button'
import { getReportSnapshot } from '@/app/actions/reports'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
}

export default async function PartnerReportViewerPage({ params }: Props) {
  const { snapshotId } = await params
  const snapshot = await getReportSnapshot(snapshotId)
  if (!snapshot) {
    notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      <div className="flex items-center justify-between">
        <Link
          href="/partner/campaigns"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to campaigns
        </Link>
        <ReportPdfButton
          snapshotId={snapshotId}
          initialPdfUrl={snapshot.pdfUrl}
          initialPdfStatus={snapshot.pdfStatus}
          variant="outline"
        />
      </div>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
