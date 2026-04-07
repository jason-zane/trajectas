import { Building2 } from "lucide-react"
import { redirect, notFound } from "next/navigation"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import { isClientBrandingEnabled } from "@/app/actions/client-entitlements"
import { canManageClient, resolveAuthorizedScope } from "@/lib/auth/authorization"
import { resolveClientOrg } from "@/lib/auth/resolve-client-org"
import { createAdminClient } from "@/lib/supabase/admin"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type { BrandConfig } from "@/lib/brand/types"
import { ClientBrandEditor } from "@/app/(dashboard)/clients/[slug]/branding/client-brand-editor"

export default async function ClientPortalBrandPage() {
  const [{ clientId }, scope] = await Promise.all([
    resolveClientOrg("/client/settings/brand/client"),
    resolveAuthorizedScope(),
  ])

  if (!clientId) {
    redirect("/client/dashboard")
  }

  if (!canManageClient(scope, clientId)) {
    redirect("/unauthorized?reason=membership")
  }

  const db = createAdminClient()
  const { data: client } = await db
    .from("clients")
    .select("id, name, can_customize_branding, partner_id")
    .eq("id", clientId)
    .single()

  if (!client) {
    notFound()
  }

  const brandingEnabled = await isClientBrandingEnabled(clientId)
  if (!brandingEnabled) {
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

  const clientRecord = await getBrandConfig("client", clientId)

  let inheritedBrand: BrandConfig = TALENT_FIT_DEFAULTS as BrandConfig
  if (client.partner_id) {
    const partnerBrand = await getBrandConfig("partner", client.partner_id)
    if (partnerBrand) {
      inheritedBrand = partnerBrand.config
    }
  }
  if (inheritedBrand === TALENT_FIT_DEFAULTS) {
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
