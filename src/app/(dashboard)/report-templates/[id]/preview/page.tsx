import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { getReportTemplate, getEntityOptions } from '@/app/actions/reports'
import { ReportRenderer } from '@/components/reports/report-renderer'
import { buildTemplatePreviewBlocks } from '@/lib/reports/preview'

export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [template, entityOptions] = await Promise.all([
    getReportTemplate(id),
    getEntityOptions(),
  ])
  if (!template) notFound()

  const previewEntities = entityOptions.map((e) => ({ id: e.id, name: e.label, type: e.type, parentId: e.parentId }))
  const sampleBlocks = buildTemplatePreviewBlocks(
    template.blocks as Record<string, unknown>[],
    previewEntities,
    template.name,
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--report-page-bg, #fafaf8)' }}>
      {/* Sample banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-sm text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200">
        Preview — showing sample data.{' '}
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
