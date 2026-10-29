import { notFound } from "next/navigation"
import {
  getAssessmentById,
  getAssessmentCustomReportLockNameForAssessment,
} from "@/app/actions/assessments"
import { AssessmentEditShell } from "./assessment-edit-shell"
import { StandardizedPersonalityOverview } from '@/components/assessments/standardized-personality-overview'
import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'

export default async function AssessmentEditLayout({
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
  const standardizedContent = assessment.scoringProfile === 'ipip_neo_120_v1'
    ? await isWorkspaceFeatureEnabled('assessmentAuthoring')
      ? <StandardizedPersonalityOverview description={assessment.description} />
      : <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />
    : undefined

  return (
    <AssessmentEditShell
      assessment={{
        id: assessment.id,
        title: assessment.title,
        status: assessment.status,
      }}
      standardized={assessment.scoringProfile === 'ipip_neo_120_v1'}
      standardizedContent={standardizedContent}
      customReportLockName={customReportLockName}
    >
      {children}
    </AssessmentEditShell>
  )
}
