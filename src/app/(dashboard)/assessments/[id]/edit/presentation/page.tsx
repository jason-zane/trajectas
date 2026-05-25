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

  const { assessment, factors, sections } = result
  const existingBlocks =
    assessment.formatMode === "forced_choice"
      ? await getExistingBlocks(id)
      : []

  const factorIds = factors.map((f) => f.factorId)

  return (
    <PresentationEditor
      assessmentId={assessment.id}
      factorIds={factorIds}
      initialFormatMode={assessment.formatMode}
      initialFcBlockSize={(assessment.fcBlockSize as 3 | 4) ?? 3}
      existingSections={sections}
      existingBlocks={existingBlocks}
      noFactors={factorIds.length === 0}
    />
  )
}
