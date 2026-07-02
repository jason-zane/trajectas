import { notFound } from "next/navigation"
import { getClientBySlug } from "@/app/actions/clients"
import { getBrandConfig } from "@/app/actions/brand"
import { resolveInheritedBrand } from "@/lib/brand/resolve-inherited-brand"
import { ClientBrandEditor } from "./client-brand-editor"

export default async function ClientBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const client = await getClientBySlug(slug)
  if (!client) notFound()

  const clientRecord = await getBrandConfig("client", client.id)
  const inheritedBrand = await resolveInheritedBrand("client", client.id)

  return (
    <ClientBrandEditor
      clientId={client.id}
      clientName={client.name}
      initialRecord={clientRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
