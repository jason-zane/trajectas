import { notFound } from "next/navigation"
import { getPartnerBySlug } from "@/app/actions/partners"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import { PartnerBrandEditor } from "./partner-brand-editor"
import type { BrandConfig } from "@/lib/brand/types"

export default async function PartnerBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const partner = await getPartnerBySlug(slug)
  if (!partner) notFound()

  const [partnerRecord, platformRecord] = await Promise.all([
    getBrandConfig("partner", partner.id),
    getPlatformBrand(),
  ])

  const inheritedBrand: BrandConfig =
    platformRecord?.config ?? (TALENT_FIT_DEFAULTS as BrandConfig)

  return (
    <PartnerBrandEditor
      partnerId={partner.id}
      partnerName={partner.name}
      initialRecord={partnerRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
