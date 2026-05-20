import { notFound } from "next/navigation"
import {
  getAssessmentById,
  getAssessmentCustomReportLockNameForAssessment,
} from "@/app/actions/assessments"
import { AssessmentEditShell } from "@/app/(dashboard)/assessments/[id]/edit/assessment-edit-shell"

export default async function PartnerAssessmentEditLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [assessment, customReportLockName] = await Promise.all([
    getAssessmentById(id),
    getAssessmentCustomReportLockNameForAssessment(id),
  ])
  if (!assessment) notFound()

  return (
    <AssessmentEditShell
      assessment={{
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
      }}
      customReportLockName={customReportLockName}
      basePath={`/partner/assessments/${assessment.id}/edit`}
    >
      {children}
    </AssessmentEditShell>
  )
}
