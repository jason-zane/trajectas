import { redirect } from "next/navigation";
import { resolveAuthorizedScope, AuthenticationRequiredError } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves the active client organization ID for client portal pages.
 *
 * Uses resolveAuthorizedScope directly (not resolveWorkspaceAccess) so that
 * platform admins can access the client portal regardless of surface gating.
 *
 * Resolution order:
 * 1. Active context tenantId (if set)
 * 2. First client membership (if any)
 * 3. First org in database (platform admin / local dev fallback)
 */
export async function resolveClientOrg(
  redirectPath: string
): Promise<{ orgId: string }> {
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
  const hasClientAccess =
    scope.isLocalDevelopmentBypass ||
    hasPlatformAdminRole ||
    scope.clientIds.length > 0;

  if (!hasClientAccess) {
    redirect("/unauthorized?reason=membership");
  }

  // 1. Try active context
  let orgId = scope.activeContext?.tenantId;

  // 2. Try first client membership
  if (!orgId && scope.clientIds.length > 0) {
    orgId = scope.clientIds[0];
  }

  // 3. Platform admin / local dev fallback — pick first org
  if (!orgId && (hasPlatformAdminRole || scope.isLocalDevelopmentBypass)) {
    const db = createAdminClient();
    const { data } = await db
      .from("organizations")
      .select("id")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(1)
      .single();
    orgId = data?.id;
  }

  if (!orgId) {
    redirect("/unauthorized?reason=membership");
  }

  return { orgId };
}
