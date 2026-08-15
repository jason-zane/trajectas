import { notFound } from 'next/navigation'
import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTechnicalReportData } from '@/lib/dal/instrument'
import { generateInstrumentReportPdf } from '@/lib/instrument/report-pdf'
import { requireAdminScope } from '@/lib/auth/authorization'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ buildId: string }> }
) {
  const { buildId } = await params

  try {
    await requireAdminScope()

    const db = createAdminClient()

    // Verify the build exists
    const reportData = await getTechnicalReportData(db, buildId)
    if (!reportData) {
      notFound()
    }

    const pdfBuffer = await generateInstrumentReportPdf(buildId)
    const filename = `${reportData.build.name}-technical-report.pdf`.replace(/[^a-z0-9-]/gi, '-')

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate PDF'
    console.error('Technical report PDF generation failed:', message)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
