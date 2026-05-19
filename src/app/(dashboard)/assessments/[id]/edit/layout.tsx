import { notFound } from "next/navigation"
import { getAssessmentById } from "@/app/actions/assessments"
import { AssessmentEditShell } from "./assessment-edit-shell"

export default async function AssessmentEditLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const assessment = await getAssessmentById(id)
  if (!assessment) notFound()

  return (
    <AssessmentEditShell
      assessment={{
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
      }}
    >
      {children}
    </AssessmentEditShell>
  )
}
