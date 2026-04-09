import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getParticipantReportSnapshot } from '@/app/actions/assess'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ token: string; snapshotId: string }>
}

export default async function ParticipantReportPage({ params }: Props) {
  const { token, snapshotId } = await params
  const snapshot = await getParticipantReportSnapshot(token, snapshotId)
  if (!snapshot || snapshot.status !== 'released') {
    notFound()
  }

  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  // Build PDF download URL — use the API endpoint with participant token
  // so that PDFs are generated on-demand if they don't exist yet
  const pdfDownloadUrl = snapshot.pdfUrl
    ? snapshot.pdfUrl
    : `/api/reports/${snapshotId}/pdf?token=${encodeURIComponent(token)}`

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16 p-6">
      <div className="flex justify-end">
        <a href={pdfDownloadUrl} download>
          <Button variant="outline">
            <Download className="size-4" />
            Download Report
          </Button>
        </a>
      </div>
      <div className="space-y-8">
        <Suspense>
          <ReportRenderer blocks={blocks} />
        </Suspense>
      </div>
    </div>
  )
}
