import { notFound } from "next/navigation"
import { getOrganizationBySlug } from "@/app/actions/organizations"
import { getEffectiveBrandRecord } from "@/app/actions/brand"
import { ClientBrandEditor } from "./client-brand-editor"

export default async function OrganizationBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const organization = await getOrganizationBySlug(slug)
  if (!organization) notFound()

  const brandRecord = await getEffectiveBrandRecord("organization", organization.id)

  return (
    <ClientBrandEditor
      organization={organization}
      initialRecord={brandRecord}
    />
  )
}
