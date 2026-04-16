import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { mapReportTemplateRow } from '@/lib/supabase/mappers'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'
import { verifyPreviewPdfToken } from '@/lib/reports/preview-pdf-token'
import { loadPreviewEntitiesForAssessment } from '@/lib/reports/preview-entities'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ assessment?: string; pdfToken?: string }>
}

export default async function PrintPreviewPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  // The pdfToken is the auth — no cookie-based auth because this route is
  // fetched by Puppeteer. Token signing is scoped to (templateId, assessmentId).
  if (!sp.assessment || !verifyPreviewPdfToken(sp.pdfToken, id, sp.assessment)) {
    notFound()
  }

  const db = createAdminClient()
  const { data: templateRow } = await db
    .from('report_templates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()
  if (!templateRow) notFound()
  const template = mapReportTemplateRow(templateRow)

  const previewEntities = await loadPreviewEntitiesForAssessment(db, sp.assessment)

  const sampleBlocks = buildTemplatePreviewBlocks(
    template.blocks as Record<string, unknown>[],
    previewEntities,
    template.name,
  )

  return (
    <Suspense>
      <ReportRenderer blocks={sampleBlocks} className="print-report" />
    </Suspense>
  )
}
