import { notFound } from "next/navigation"
import {
  getAssessmentWithFactors,
  getFactorsForBuilder,
  getConstructsForBuilder,
} from "@/app/actions/assessments"
import { CompositionEditor } from "./composition-editor"

export default async function AssessmentCompositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [result, allFactors, allConstructs] = await Promise.all([
    getAssessmentWithFactors(id),
    getFactorsForBuilder(),
    getConstructsForBuilder(),
  ])

  if (!result) notFound()

  return (
    <CompositionEditor
      assessmentId={result.assessment.id}
      scoringLevel={result.assessment.scoringLevel}
      hasExistingSections={result.sections.length > 0}
      initialFactorIds={result.factors.map((f) => f.factorId)}
      initialConstructIds={result.constructs.map((c) => c.constructId)}
      allFactors={allFactors}
      allConstructs={allConstructs}
    />
  )
}
