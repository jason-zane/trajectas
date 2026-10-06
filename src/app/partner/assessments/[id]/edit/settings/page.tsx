import { isWorkspaceFeatureEnabled } from '@/lib/features/access'
import { WorkspaceFeatureUnavailable } from '@/components/workspace-feature-unavailable'
import { notFound } from "next/navigation"
import { getAssessmentWithFactors } from "@/app/actions/assessments"
import { SettingsPanel } from "@/app/(dashboard)/assessments/[id]/edit/settings/settings-panel"

export default async function PartnerAssessmentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  if (!await isWorkspaceFeatureEnabled('assessmentAuthoring')) return <WorkspaceFeatureUnavailable feature="assessmentAuthoring" />

  const { id } = await params
  const result = await getAssessmentWithFactors(id)
  if (!result) notFound()

  const { assessment, factors } = result

  return (
    <SettingsPanel
      assessmentId={assessment.id}
      selectedFactorCount={factors.length}
      initialMinCustomFactors={assessment.minCustomFactors ?? null}
      initialScoringProfile={assessment.scoringProfile}
      listPath="/partner/assessments"
    />
  )
}
