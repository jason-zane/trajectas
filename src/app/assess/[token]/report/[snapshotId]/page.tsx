import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { getParticipantReportSnapshot } from '@/app/actions/assess'
import { buildSurfaceUrl } from '@/lib/hosts'
import { createParticipantPdfRateLimitProof } from '@/lib/reports/pdf-rate-limit-proof'
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

  // Build an absolute URL to the admin API for PDF download, since the
  // participant page may be served from a different domain (assess.*).
  // Mint after the released-report access check. Keep the raw token on the
  // download so the route continues to check token validity/deletion/ownership.
  const query = new URLSearchParams({
    token,
    pdfRateLimitProof: createParticipantPdfRateLimitProof(token, snapshotId),
  }).toString()
  const pdfDownloadUrl =
    buildSurfaceUrl('admin', `/api/reports/${snapshotId}/pdf`, query)?.toString()
    ?? `/api/reports/${snapshotId}/pdf?${query}`

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
