import { notFound } from 'next/navigation'
import { GrowthReportPrint } from '@/components/canvas/growth-report-print'
import { verifyReportPdfToken } from '@/lib/reports/pdf-token'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CanvasResult, CanvasViewState } from '@/lib/canvas/types'

interface Props {
  params: Promise<{ snapshotId: string }>
  searchParams: Promise<{ pdfToken?: string }>
}

/**
 * Print surface for the growth report. Reachable only with a short-lived
 * HMAC token minted by the PDF endpoint (same scheme as report PDFs), so
 * the admin-client read below is token-gated, not cookie-gated.
 */
export default async function PrintTrajectoryReportPage({ params, searchParams }: Props) {
  const { snapshotId } = await params
  const { pdfToken } = await searchParams

  if (!verifyReportPdfToken(pdfToken, snapshotId)) {
    notFound()
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('comparison_snapshots')
    .select('id, title, canvas, view_state, generated_at, client_id, clients(name)')
    .eq('id', snapshotId)
    .maybeSingle()

  if (error || !data) notFound()

  const clients = Array.isArray(data.clients) ? data.clients[0] : data.clients
  return (
    <GrowthReportPrint
      result={data.canvas as CanvasResult}
      viewState={(data.view_state ?? {}) as CanvasViewState}
      clientName={clients?.name ? String(clients.name) : null}
      generatedAt={String(data.generated_at)}
    />
  )
}
