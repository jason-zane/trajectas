import { Building2 } from "lucide-react"
import { notFound, redirect } from "next/navigation"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { canManagePartner, resolveAuthorizedScope } from "@/lib/auth/authorization"
import { resolvePartnerOrg } from "@/lib/auth/resolve-partner-org"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { createAdminClient } from "@/lib/supabase/admin"
import type { BrandConfig } from "@/lib/brand/types"
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-sm space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Building2 className="size-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            Brand customisation is not enabled
          </h2>
          <p className="text-sm text-muted-foreground">
            Contact your administrator to enable brand customisation for your organisation.
          </p>
        </div>
      </div>
    )
  }

  const [partnerRecord, platformRecord] = await Promise.all([
    getBrandConfig("partner", partnerId),
    getPlatformBrand(),
  ])

  const inheritedBrand: BrandConfig =
    platformRecord?.config ?? (TRAJECTAS_DEFAULTS as BrandConfig)

  return (
    <PartnerBrandEditor
      partnerId={partner.id}
      partnerName={partner.name}
      initialRecord={partnerRecord}
      inheritedBrand={inheritedBrand}
    />
  )
}
