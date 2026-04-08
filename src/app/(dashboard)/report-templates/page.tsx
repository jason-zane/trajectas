import { LayoutTemplate } from 'lucide-react'
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

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card py-16 text-center shadow-sm">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LayoutTemplate className="size-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">No templates yet</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create a template to start building reports for campaigns.
            </p>
          </div>
          <CreateTemplateButton />
        </div>
      ) : (
        <ReportTemplatesTable templates={templates} />
      )}
    </div>
  )
}
