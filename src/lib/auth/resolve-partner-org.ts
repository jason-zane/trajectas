import { redirect } from "next/navigation";
import {
  resolveAuthorizedScope,
  AuthenticationRequiredError,
} from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves the active partner ID for partner portal pages.
 *
 * Uses resolveAuthorizedScope directly (not resolveWorkspaceAccess) so that
 * platform admins can access the partner portal regardless of surface gating.
 *
 * Resolution order:
 * 1. Active context tenantId (if tenantType === 'partner')
 * 2. First partner membership (if any)
 * 3. First partner in database (platform admin / local dev fallback)
 */
export async function resolvePartnerOrg(
  redirectPath: string
): Promise<{ partnerId: string | null }> {
  let scope;
  try {
    scope = await resolveAuthorizedScope();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect(`/login?next=${encodeURIComponent(redirectPath)}`);
    }
    throw error;
  }

  const actor = scope.actor;
  const hasPlatformAdminRole = actor?.isActive && actor.role === "platform_admin";
  const hasPartnerAccess =
    scope.isLocalDevelopmentBypass ||
    hasPlatformAdminRole ||
    scope.partnerIds.length > 0;

  if (!hasPartnerAccess) {
    redirect("/unauthorized?reason=membership");
  }

  let partnerId =
    scope.activeContext?.tenantType === "partner"
      ? scope.activeContext.tenantId
      : null;

  if (!partnerId && scope.partnerIds.length > 0) {
    partnerId = scope.partnerIds[0];
  }

  if (!partnerId && (hasPlatformAdminRole || scope.isLocalDevelopmentBypass)) {
    const db = createAdminClient();
    const { data } = await db
      .from("partners")
      .select("id")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(1)
      .single();
    partnerId = data?.id ?? null;
  }

  return { partnerId: partnerId ?? null };
}
