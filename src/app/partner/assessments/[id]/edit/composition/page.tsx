import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from "next/navigation"
import {
  getAssessmentWithFactors,
  getFactorsForBuilder,
} from "@/app/actions/assessments"
import { CompositionEditor } from "@/app/(dashboard)/assessments/[id]/edit/composition/composition-editor"

export default async function PartnerAssessmentCompositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!await isWorkspaceFeatureEnabled('assessmentAuthoring')) return <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />

  const { id } = await params
  const [result, allFactors] = await Promise.all([
    getAssessmentWithFactors(id),
    getFactorsForBuilder(),
  ])

  if (!result) notFound()

  return (
    <CompositionEditor
      assessmentId={result.assessment.id}
      hasExistingSections={result.sections.length > 0}
      initialFactorIds={result.factors.map((f) => f.factorId)}
      allFactors={allFactors}
      showLibraryLinks={false}
    />
  )
}
