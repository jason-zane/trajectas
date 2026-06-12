import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PrintPaginatedReport } from '@/components/reports/print-paginated-report'
import { verifyReportPdfToken } from '@/lib/reports/pdf-token'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapReportSnapshotRow } from '@/lib/supabase/mappers'
import type { ResolvedBlockData } from '@/lib/reports/types'

interface Props {
  params: Promise<{ snapshotId: string }>
  searchParams: Promise<{ pdfToken?: string }>
}

export default async function PrintReportPage({ params, searchParams }: Props) {
  const { snapshotId } = await params
  const { pdfToken } = await searchParams

  if (!verifyReportPdfToken(pdfToken, snapshotId)) {
    notFound()
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('report_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .maybeSingle()

  if (error || !data) notFound()

  const snapshot = mapReportSnapshotRow(data)
  const blocks = (snapshot.renderedData ?? []) as ResolvedBlockData[]

  return (
    <Suspense>
      <PrintPaginatedReport blocks={blocks} className="print-report" />
    </Suspense>
  )
}
