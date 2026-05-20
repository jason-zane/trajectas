import { notFound } from "next/navigation"
import { getAssessmentWithFactors } from "@/app/actions/assessments"
import { SettingsPanel } from "@/app/(dashboard)/assessments/[id]/edit/settings/settings-panel"

export default async function PartnerAssessmentSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getAssessmentWithFactors(id)
  if (!result) notFound()

  const { assessment, factors, constructs } = result

  return (
    <SettingsPanel
      assessmentId={assessment.id}
      scoringLevel={assessment.scoringLevel}
      selectedFactorCount={factors.length}
      selectedConstructCount={constructs.length}
      initialMinCustomFactors={assessment.minCustomFactors ?? null}
      initialMinCustomConstructs={assessment.minCustomConstructs ?? null}
      listPath="/partner/assessments"
    />
  )
}
