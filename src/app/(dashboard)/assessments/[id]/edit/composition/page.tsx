import { Suspense } from "react"
import { notFound } from "next/navigation"
import {
  getAssessmentWithFactors,
  getFactorsForBuilder,
} from "@/app/actions/assessments"
import { CompositionEditor } from "./composition-editor"
import { DenseEditorSkeleton } from "@/components/loading/dense-editor-skeleton"

// Async component for the editor body
async function CompositionEditorContent({
  id,
}: {
  id: string
}) {
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

export default async function AssessmentCompositionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <Suspense fallback={<DenseEditorSkeleton />}>
      <CompositionEditorContent id={id} />
    </Suspense>
  )
}
