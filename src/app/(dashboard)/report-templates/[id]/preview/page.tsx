import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import {
  getReportTemplate,
  getPreviewEntitiesForAssessment,
  listAssessmentsForPreview,
} from '@/app/actions/reports'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'

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
    <div className="min-h-screen" style={{ background: 'var(--report-page-bg, #fafaf8)' }}>
      {/* Sample banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200">
        Preview — showing sample data
        {selectedAssessment ? ` for ${selectedAssessment.title}` : ''}.{' '}
        <a href={`/report-templates/${id}/builder`} className="underline hover:no-underline">
          Back to builder
        </a>
      </div>
      <Suspense>
        <ReportRenderer blocks={sampleBlocks} />
      </Suspense>
    </div>
  )
}
