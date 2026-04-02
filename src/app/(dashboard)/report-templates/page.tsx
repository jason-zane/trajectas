import Link from 'next/link'
import { LayoutTemplate, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ScrollReveal } from '@/components/scroll-reveal'
import { getReportTemplates } from '@/app/actions/reports'
import { CreateTemplateButton } from './create-template-button'
import { CloneTemplateButton } from './clone-template-button'
import { DeleteTemplateButton } from './delete-template-button'
import { ActiveToggle } from './active-toggle'

const REPORT_TYPE_LABELS: Record<string, string> = {
  self_report: 'Self-report',
  '360': '360',
}

const DISPLAY_LEVEL_LABELS: Record<string, string> = {
  dimension: 'Dimension',
  factor: 'Factor',
  construct: 'Construct',
}

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

      <ScrollReveal>
        <div className="rounded-xl border border-border bg-card shadow-sm">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Display level</TableHead>
                  <TableHead>Blocks</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id} className="group">
                    <TableCell>
                      <Link
                        href={`/report-templates/${template.id}/builder`}
                        className="flex items-center gap-3 -my-1"
                      >
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <LayoutTemplate className="size-3.5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm leading-tight">{template.name}</p>
                          {template.description && (
                            <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {template.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {REPORT_TYPE_LABELS[template.reportType] ?? template.reportType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {DISPLAY_LEVEL_LABELS[template.displayLevel] ?? template.displayLevel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {template.blocks.length}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ActiveToggle
                        templateId={template.id}
                        isActive={template.isActive}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <CloneTemplateButton templateId={template.id} />
                        <DeleteTemplateButton templateId={template.id} />
                        <Link href={`/report-templates/${template.id}/builder`}>
                          <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground transition-colors" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </ScrollReveal>
    </div>
  )
}
