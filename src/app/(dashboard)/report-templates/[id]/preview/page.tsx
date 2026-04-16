import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { PreviewPdfButton } from '@/components/reports/preview-pdf-button'
import {
  getReportTemplate,
  getPreviewEntitiesForAssessment,
  listAssessmentsForPreview,
} from '@/app/actions/reports'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'
import { PreviewAssessmentSelector } from './preview-assessment-selector'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ assessment?: string }>
}

export default async function PreviewPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams

  const [template, assessments] = await Promise.all([
    getReportTemplate(id),
    listAssessmentsForPreview(),
  ])
  if (!template) notFound()

  const selectedId = sp.assessment ?? assessments[0]?.id ?? null
  const selectedAssessment = selectedId
    ? assessments.find((a) => a.id === selectedId) ?? null
    : null

  const previewEntities = selectedId
    ? await getPreviewEntitiesForAssessment(selectedId)
    : []

  const sampleBlocks = buildTemplatePreviewBlocks(
    template.blocks as Record<string, unknown>[],
    previewEntities,
    template.name,
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <PageHeader
        eyebrow="Report templates"
        title={template.name}
        description={
          selectedAssessment
            ? `Preview — sample data for ${selectedAssessment.title}`
            : 'Preview'
        }
      >
        <div className="flex items-center gap-2">
          <PreviewAssessmentSelector
            templateId={id}
            assessments={assessments}
            selectedAssessmentId={selectedId}
          />
          <PreviewPdfButton templateId={id} assessmentId={selectedId} />
        </div>
      </PageHeader>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <Suspense>
          <ReportRenderer blocks={sampleBlocks} />
        </Suspense>
      </div>
    </div>
  )
}
