import { notFound } from "next/navigation"
import { getClientBySlug } from "@/app/actions/clients"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type { BrandConfig } from "@/lib/brand/types"
import { ClientBrandEditor } from "./client-brand-editor"

export default async function ClientBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const client = await getClientBySlug(slug)
  if (!client) notFound()

  const [clientRecord, platformRecord] = await Promise.all([
    getBrandConfig("client", client.id),
    getPlatformBrand(),
  ])
  const inheritedBrand: BrandConfig =
    platformRecord?.config ?? (TALENT_FIT_DEFAULTS as BrandConfig)

  return (
    <ClientBrandEditor
      clientId={client.id}
      clientName={client.name}
      initialRecord={clientRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
