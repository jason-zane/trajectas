import { notFound } from "next/navigation"

import { getAssessmentById } from "@/app/actions/assessments"
import { getAssessmentIntro } from "@/app/actions/assessment-intro"
import { AssessmentIntroEditor } from "@/app/(dashboard)/assessments/[id]/edit/intro/assessment-intro-editor"

export default async function PartnerAssessmentIntroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [assessment, introContent] = await Promise.all([
    getAssessmentById(id),
    getAssessmentIntro(id),
  ])

  if (!assessment) notFound()

  return (
    <AssessmentIntroEditor
      assessmentId={id}
      assessmentTitle={assessment.title}
      initialContent={introContent}
    />
  )
}
