import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAssessmentWithFactors } from '@/app/actions/assessments'
import { getAssessmentTemplates, getReportTemplates } from '@/app/actions/reports'
import { AssessmentReportsPanel } from './assessment-reports-panel'

export default async function AssessmentReportsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [result, attached, allTemplates] = await Promise.all([
    getAssessmentWithFactors(id),
    getAssessmentTemplates(id),
    getReportTemplates(),
  ])

  if (!result) notFound()

  return (
    <>
      <nav className="mb-6 flex gap-6 border-b border-border">
        <Link
          href={`/assessments/${id}/edit`}
          className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Builder
        </Link>
        <Link
          href={`/assessments/${id}/edit/intro`}
          className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Intro
        </Link>
        <span className="border-b-2 border-primary pb-2 text-sm font-medium text-foreground">
          Reports
        </span>
      </nav>

      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which report templates fire by default when a participant completes the
            <span className="font-medium"> {result.assessment.title}</span> assessment.
          </p>
        </div>
        <AssessmentReportsPanel
          assessmentId={id}
          initialAttached={attached}
          allTemplates={allTemplates}
        />
      </div>
    </>
  )
}
