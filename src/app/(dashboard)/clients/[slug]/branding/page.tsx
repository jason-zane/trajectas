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

  const clientRecord = await getBrandConfig("client", client.id)

  let inheritedBrand: BrandConfig = TALENT_FIT_DEFAULTS as BrandConfig

  if (client.partnerId) {
    const partnerBrand = await getBrandConfig("partner", client.partnerId)
    if (partnerBrand) {
      inheritedBrand = partnerBrand.config
    } else {
      const platform = await getPlatformBrand()
      if (platform) inheritedBrand = platform.config
    }
  } else {
    const platform = await getPlatformBrand()
    if (platform) inheritedBrand = platform.config
  }

  return (
    <ClientBrandEditor
      clientId={client.id}
      clientName={client.name}
      initialRecord={clientRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
