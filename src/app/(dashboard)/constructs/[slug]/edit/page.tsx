import { notFound } from "next/navigation"
import { getConstructBySlug } from "@/app/actions/constructs"
import { ConstructForm } from "../../construct-form"

export default async function EditConstructPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const construct = await getConstructBySlug(slug)
  if (!construct) notFound()

  return <ConstructForm mode="edit" construct={construct} />
}
