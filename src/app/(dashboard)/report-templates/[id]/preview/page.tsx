import { ReportPreviewSurface } from '@/components/reports/report-preview-surface'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { PageHeader } from '@/components/page-header'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { PreviewPdfButton } from '@/components/reports/preview-pdf-button'
import {
  getReportTemplate,
  getResolvedReportTemplateBandScheme,
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
  if (!await isWorkspaceFeatureEnabled('reportTemplateAuthoring')) return <WorkspaceFeatureUnavailable feature="reportTemplateAuthoring" />

  const { id } = await params
  const sp = await searchParams

  const [template, assessments, scheme] = await Promise.all([
    getReportTemplate(id),
    listAssessmentsForPreview(),
    getResolvedReportTemplateBandScheme(id),
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
    scheme,
    template.customReportSlug, template.presentationConfig,
  )

  return (
    <div className={`${template.customReportSlug ? 'max-w-4xl' : 'max-w-3xl'} mx-auto space-y-6 pb-16`}>
      <PageHeader
        eyebrow="Report templates"
        title={template.name}
        description={
          selectedAssessment && !template.customReportSlug
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

      <ReportPreviewSurface blocks={sampleBlocks}>
        <Suspense>
          <ReportRenderer blocks={sampleBlocks} />
        </Suspense>
      </ReportPreviewSurface>
    </div>
  )
}
