import { notFound } from "next/navigation"
import { getConstructBySlug } from "@/app/actions/constructs"
import { getConstructDimensions } from "@/app/actions/dimension-constructs"
import { getDimensionsForSelect } from "@/app/actions/factors"
import { ConstructForm } from "../../construct-form"

export default async function EditConstructPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const construct = await getConstructBySlug(slug)
  if (!construct) notFound()

  const [constructDimensions, allDimensions] = await Promise.all([
    getConstructDimensions(construct.id),
    getDimensionsForSelect(),
  ])

  return (
    <ConstructForm
      mode="edit"
      construct={construct}
      constructDimensions={constructDimensions}
      allDimensions={allDimensions}
    />
  )
}
