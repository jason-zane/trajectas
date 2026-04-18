import { NextResponse } from "next/server";
import { resolveAuthorizedScope } from "@/lib/auth/authorization";
import { resolveClientOrg } from "@/lib/auth/resolve-client-org";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const scope = await resolveAuthorizedScope();
  const { clientId } = await resolveClientOrg("/api/_debug-scope");

  const db = await createClient();
  const { data: rlsCampaigns, error: rlsErr } = await db
    .from("campaigns_with_counts")
    .select("id, title, client_id, status")
    .eq("client_id", clientId ?? "")
    .is("deleted_at", null);

  const admin = createAdminClient();
  const { data: adminCampaigns } = await admin
    .from("campaigns")
    .select("id, title, client_id, status")
    .eq("client_id", clientId ?? "")
    .is("deleted_at", null);

  return NextResponse.json({
    actor: scope.actor ? { id: scope.actor.id, email: scope.actor.email, role: scope.actor.role } : null,
    isPlatformAdmin: scope.isPlatformAdmin,
    isLocalDevelopmentBypass: scope.isLocalDevelopmentBypass,
    clientIdsInScope: scope.clientIds,
    requestSurface: scope.requestSurface,
    activeContextTenantId: scope.activeContext?.tenantId ?? null,
    activeContextTenantType: scope.activeContext?.tenantType ?? null,
    resolvedClientId: clientId,
    rlsError: rlsErr?.message ?? null,
    rlsCampaignCount: rlsCampaigns?.length ?? 0,
    rlsCampaigns: rlsCampaigns ?? [],
    adminCampaignCount: adminCampaigns?.length ?? 0,
    adminCampaigns: adminCampaigns ?? [],
  });
}
