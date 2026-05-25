import { notFound } from "next/navigation"
import { getDimensionBySlug } from "@/app/actions/dimensions"
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

  const contentSources = await getContentSources()

  return (
    <DimensionForm
      mode="edit"
      dimension={dimension}
      contentSources={contentSources}
    />
  )
}
