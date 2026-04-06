import { notFound } from "next/navigation"
import {
  getFactorBySlug,
  getDimensionsForSelect,
  getConstructsForSelect,
  getClientsForFactorSelect,
} from "@/app/actions/factors"
import { FactorForm } from "../../factor-form"

export default async function EditFactorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [factor, dimensions, constructs, clients] = await Promise.all([
    getFactorBySlug(slug),
    getDimensionsForSelect(),
    getConstructsForSelect(),
    getClientsForFactorSelect(),
  ])

  if (!factor) notFound()

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      clients={clients}
      mode="edit"
      factorId={factor.id}
      initialData={{
        name: factor.name,
        slug: factor.slug,
        description: factor.description,
        definition: factor.definition,
        dimensionId: factor.dimensionId,
        isActive: factor.isActive,
        isMatchEligible: factor.isMatchEligible,
        clientId: factor.clientId,
        indicatorsLow: factor.indicatorsLow,
        indicatorsMid: factor.indicatorsMid,
        indicatorsHigh: factor.indicatorsHigh,
        linkedConstructs: factor.linkedConstructs,
        linkedAssessments: factor.linkedAssessments,
      }}
    />
  )
}
