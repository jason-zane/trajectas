import { notFound } from "next/navigation"
import {
  getAssessmentWithFactors,
  getFactorsForBuilder,
} from "@/app/actions/assessments"
import { CompositionEditor } from "./composition-editor"

export default async function AssessmentCompositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
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
    />
  )
}
