import { PageHeader } from '@/components/page-header'
import { getReportTemplates } from '@/app/actions/reports'
import { CreateTemplateButton } from './create-template-button'
import { ReportTemplatesTable } from './report-templates-table'

export default async function ReportTemplatesPage() {
  const templates = await getReportTemplates()

  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader
        eyebrow="Assessments"
        title="Report Templates"
        description="Reusable report layouts. Assign templates to campaigns via campaign settings."
      >
        <CreateTemplateButton />
      </PageHeader>

      <ReportTemplatesTable templates={templates} />
    </div>
  )
}
