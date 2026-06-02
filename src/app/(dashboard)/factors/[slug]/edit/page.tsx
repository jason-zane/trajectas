import { notFound } from "next/navigation"
import {
  getFactorBySlug,
  getDimensionsForSelect,
  getConstructsForSelect,
  getClientsForFactorSelect,
} from "@/app/actions/factors"
import { getContentSources } from "@/app/actions/content-sources"
import { getLibraryCategories } from "@/app/actions/categories"
import { FactorForm } from "../../factor-form"

export default async function EditFactorPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [factor, dimensions, constructs, clients, contentSources, categories] = await Promise.all([
    getFactorBySlug(slug),
    getDimensionsForSelect(),
    getConstructsForSelect(),
    getClientsForFactorSelect(),
    getContentSources(),
    getLibraryCategories(),
  ])

  if (!factor) notFound()

  return (
    <FactorForm
      dimensions={dimensions}
      availableConstructs={constructs}
      clients={clients}
      categories={categories}
      contentSources={contentSources}
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
        anchorLow: factor.anchorLow,
        anchorHigh: factor.anchorHigh,
        strengthCommentary: factor.strengthCommentary,
        developmentSuggestion: factor.developmentSuggestion,
        sourceId: factor.sourceId,
        compositionLocked: factor.compositionLocked,
        applicableOutcomes: factor.applicableOutcomes,
        applicableLevels: factor.applicableLevels,
        applicableFunctions: factor.applicableFunctions,
        primaryCategoryId: factor.primaryCategoryId,
        secondaryCategoryId: factor.secondaryCategoryId,
        linkedConstructs: factor.linkedConstructs,
        linkedAssessments: factor.linkedAssessments,
      }}
    />
  )
}
