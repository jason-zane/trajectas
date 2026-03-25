import { notFound } from "next/navigation"
import {
  getCompetencyBySlug,
  getDimensionsForSelect,
  getTraitsForSelect,
} from "@/app/actions/competencies"
import { CompetencyForm } from "../../competency-form"

export default async function EditCompetencyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [competency, dimensions, traits] = await Promise.all([
    getCompetencyBySlug(slug),
    getDimensionsForSelect(),
    getTraitsForSelect(),
  ])

  if (!competency) notFound()

  return (
    <CompetencyForm
      dimensions={dimensions}
      availableTraits={traits}
      mode="edit"
      competencyId={competency.id}
      initialData={{
        name: competency.name,
        slug: competency.slug,
        description: competency.description,
        definition: competency.definition,
        dimensionId: competency.dimensionId,
        isActive: competency.isActive,
        indicatorsLow: competency.indicatorsLow,
        indicatorsMid: competency.indicatorsMid,
        indicatorsHigh: competency.indicatorsHigh,
        linkedTraits: competency.linkedTraits,
      }}
    />
  )
}
