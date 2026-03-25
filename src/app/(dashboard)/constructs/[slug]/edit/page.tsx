import { notFound } from "next/navigation"
import { getTraitBySlug } from "@/app/actions/traits"
import { ConstructForm } from "../../construct-form"

export default async function EditConstructPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const trait = await getTraitBySlug(slug)
  if (!trait) notFound()

  return <ConstructForm mode="edit" trait={trait} />
}
