import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from "next/navigation"

import { requireAdminScope } from "@/lib/auth/authorization"
import { getAssessmentById } from "@/app/actions/assessments"
import { getAssessmentIntro } from "@/app/actions/assessment-intro"
import { AssessmentIntroEditor } from "./assessment-intro-editor"

export default async function AssessmentIntroPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!await isWorkspaceFeatureEnabled('assessmentAuthoring')) return <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />

  await requireAdminScope()
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
