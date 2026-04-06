import { notFound } from "next/navigation"
import { getClientBySlug } from "@/app/actions/clients"
import { getEffectiveBrandRecord } from "@/app/actions/brand"
import { ClientBrandEditor } from "./client-brand-editor"

export default async function ClientBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const client = await getClientBySlug(slug)
  if (!client) notFound()

  const brandRecord = await getEffectiveBrandRecord("client", client.id)

  return (
    <ClientBrandEditor
      client={client}
      initialRecord={brandRecord}
    />
  )
}
