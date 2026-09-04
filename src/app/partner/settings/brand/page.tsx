import { notFound, redirect } from "next/navigation"
import { getBrandConfig } from "@/app/actions/brand"
import { EmptyState } from "@/components/empty-state"
import { canManagePartner, resolveAuthorizedScope } from "@/lib/auth/authorization"
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org"
import { createAdminClient } from "@/lib/supabase/admin"
import { resolveInheritedBrand } from "@/lib/brand/resolve-inherited-brand"
import { PartnerBrandEditor } from "@/app/(dashboard)/partners/[slug]/branding/partner-brand-editor"

export default async function PartnerPortalBrandPage() {
  const [{ partnerId }, scope] = await Promise.all([
    resolvePartnerOrg("/partner/settings/brand"),
    resolveAuthorizedScope(),
  ])

  if (!partnerId) {
    redirect("/partner")
  }

  if (!canManagePartner(scope, partnerId)) {
    redirect("/unauthorized?reason=membership")
  }

  const db = createAdminClient()
  const { data: partner } = await db
    .from("partners")
    .select("id, name, can_customize_branding")
    .eq("id", partnerId)
    .single()

  if (!partner) {
    notFound()
  }

  if (!partner.can_customize_branding) {
    return (
      <EmptyState
        eyebrow="Branding"
        title="Brand customisation is not enabled"
        description="Trajectas has not enabled brand customisation for your partner organisation yet. Contact Trajectas to switch it on."
      />
    )
  }

  const [partnerRecord, inheritedBrand] = await Promise.all([
    getBrandConfig("partner", partnerId),
    resolveInheritedBrand("partner", partnerId),
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
