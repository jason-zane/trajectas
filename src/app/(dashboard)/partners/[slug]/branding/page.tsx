import { notFound } from "next/navigation"
import { getPartnerBySlug } from "@/app/actions/partners"
import { getBrandConfig } from "@/app/actions/brand"
import { resolveInheritedBrand } from "@/lib/brand/resolve-inherited-brand"
import { PartnerBrandEditor } from "./partner-brand-editor"

export default async function PartnerBrandingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const partner = await getPartnerBySlug(slug)
  if (!partner) notFound()

  const [partnerRecord, inheritedBrand] = await Promise.all([
    getBrandConfig("partner", partner.id),
    resolveInheritedBrand("partner", partner.id),
  ])

  return (
    <PartnerBrandEditor
      partnerId={partner.id}
      partnerName={partner.name}
      initialRecord={partnerRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
