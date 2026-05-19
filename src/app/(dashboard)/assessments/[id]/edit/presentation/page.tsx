import { notFound } from "next/navigation"
import {
  getAssessmentWithFactors,
  getExistingBlocks,
} from "@/app/actions/assessments"
import { PresentationEditor } from "./presentation-editor"

export default async function AssessmentPresentationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const result = await getAssessmentWithFactors(id)
  if (!result) notFound()

  const { assessment, factors, constructs, sections } = result
  const existingBlocks =
    assessment.formatMode === "forced_choice"
      ? await getExistingBlocks(id)
      : []

  const factorIds = factors.map((f) => f.factorId)
  const constructIds = constructs.map((c) => c.constructId)

  return (
    <PresentationEditor
      assessmentId={assessment.id}
      factorIds={factorIds}
      constructIds={constructIds}
      scoringLevel={assessment.scoringLevel}
      initialFormatMode={assessment.formatMode}
      initialFcBlockSize={(assessment.fcBlockSize as 3 | 4) ?? 3}
      existingSections={sections}
      existingBlocks={existingBlocks}
      noFactors={
        assessment.scoringLevel === "factor"
          ? factorIds.length === 0
          : constructIds.length === 0
      }
    />
  )
}
