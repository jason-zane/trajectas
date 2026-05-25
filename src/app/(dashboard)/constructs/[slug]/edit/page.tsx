import { notFound } from "next/navigation"
import { getConstructBySlug } from "@/app/actions/constructs"
import { getContentSources } from "@/app/actions/content-sources"
import { ConstructForm } from "../../construct-form"

export default async function EditConstructPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const construct = await getConstructBySlug(slug)
  if (!construct) notFound()

  const contentSources = await getContentSources()

  return (
    <ConstructForm
      mode="edit"
      construct={construct}
      contentSources={contentSources}
    />
  )
}
