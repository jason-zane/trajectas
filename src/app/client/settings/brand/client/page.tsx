import { Building2 } from "lucide-react"
import { redirect, notFound } from "next/navigation"
import { getBrandConfig, getPlatformBrand } from "@/app/actions/brand"
import {
  AuthenticationRequiredError,
  canManageClient,
  resolveAuthorizedScope,
} from "@/lib/auth/authorization"
import { createAdminClient } from "@/lib/supabase/admin"
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults"
import type { BrandConfig } from "@/lib/brand/types"
import { ClientBrandEditor } from "@/app/(dashboard)/clients/[slug]/branding/client-brand-editor"

export default async function ClientPortalBrandPage() {
  let scope: Awaited<ReturnType<typeof resolveAuthorizedScope>>
  try {
    scope = await resolveAuthorizedScope()
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect(`/login?next=${encodeURIComponent("/client/settings/brand/client")}`)
    }

    throw error
  }

  const clientId = scope.activeContext?.tenantType === "client"
    ? scope.activeContext.tenantId
    : scope.clientIds[0]

  if (!clientId) {
    redirect("/client/dashboard")
  }

  if (!canManageClient(scope, clientId)) {
    redirect("/unauthorized?reason=membership")
  }

  const db = createAdminClient()
  const { data: client } = await db
    .from("clients")
    .select("id, name, can_customize_branding")
    .eq("id", clientId)
    .single()

  if (!client) {
    notFound()
  }

  if (!client.can_customize_branding) {
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

  const [clientRecord, platformRecord] = await Promise.all([
    getBrandConfig("client", clientId),
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
