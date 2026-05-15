import { notFound } from "next/navigation"
import { getDimensionBySlug } from "@/app/actions/dimensions"
import { getDimensionConstructs } from "@/app/actions/dimension-constructs"
import { getConstructsForSelect } from "@/app/actions/constructs"
import { getContentSources } from "@/app/actions/content-sources"
import { DimensionForm } from "../../dimension-form"

export default async function EditDimensionPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const dimension = await getDimensionBySlug(slug)
  if (!dimension) notFound()

  const [dimensionConstructs, allConstructs, contentSources] = await Promise.all([
    getDimensionConstructs(dimension.id),
    getConstructsForSelect(),
    getContentSources(),
  ])

  return (
    <DimensionForm
      mode="edit"
      dimension={dimension}
      dimensionConstructs={dimensionConstructs}
      allConstructs={allConstructs}
      contentSources={contentSources}
    />
  )
}
