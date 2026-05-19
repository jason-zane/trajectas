import { notFound } from "next/navigation"
import { getAssessmentWithFactors } from "@/app/actions/assessments"
import { getAssessmentTemplates, getReportTemplates } from "@/app/actions/reports"
import { AssessmentReportsPanel } from "./assessment-reports-panel"

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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Reports</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure which report templates fire by default when a participant
          completes the
          <span className="font-medium"> {result.assessment.title}</span>{" "}
          assessment.
        </p>
      </div>
      <AssessmentReportsPanel
        assessmentId={id}
        initialAttached={attached}
        allTemplates={allTemplates}
      />
    </div>
  )
}
