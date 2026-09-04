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
 * 3. First partner in database — local development only. On production hosts a
 *    platform admin with no partner membership reaches the partner portal only
 *    through an audited support session ("Enter portal"); anyone else lands on
 *    /unauthorized rather than on an arbitrary partner.
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

  if (
    !partnerId &&
    (scope.isLocalDevelopmentBypass ||
      (hasPlatformAdminRole && scope.isLocalDevelopment))
  ) {
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

  if (!partnerId && hasPlatformAdminRole && !scope.isLocalDevelopment) {
    redirect("/unauthorized?reason=membership");
  }

  return { partnerId: partnerId ?? null };
}
