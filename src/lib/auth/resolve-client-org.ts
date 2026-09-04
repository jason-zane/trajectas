import { redirect } from "next/navigation";
import { resolveAuthorizedScope, AuthenticationRequiredError } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves the active client ID for client portal pages.
 *
 * Uses resolveAuthorizedScope directly (not resolveWorkspaceAccess) so that
 * platform admins can access the client portal regardless of surface gating.
 *
 * Resolution order:
 * 1. Active context tenantId (if set)
 * 2. First client membership (if any)
 * 3. First client in database — local development only. On production hosts a
 *    platform admin with no client membership reaches the client portal only
 *    through an audited support session ("Enter portal"); anyone else lands on
 *    /unauthorized rather than on an arbitrary client.
 */
export async function resolveClientOrg(
  redirectPath: string
): Promise<{ clientId: string | null }> {
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
  let clientId = scope.activeContext?.tenantId;

  // 2. Try first client membership
  if (!clientId && scope.clientIds.length > 0) {
    clientId = scope.clientIds[0];
  }

  // 3. Local development fallback — pick the first client
  if (
    !clientId &&
    (scope.isLocalDevelopmentBypass ||
      (hasPlatformAdminRole && scope.isLocalDevelopment))
  ) {
    const db = createAdminClient();
    const { data } = await db
      .from("clients")
      .select("id")
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(1)
      .single();
    clientId = data?.id;
  }

  if (!clientId && hasPlatformAdminRole && !scope.isLocalDevelopment) {
    redirect("/unauthorized?reason=membership");
  }

  return { clientId: clientId ?? null };
}

/**
 * Verifies a campaign belongs to the resolved client.
 * Use in client portal server actions and pages before operating on a campaign.
 * Returns the clientId if the campaign is owned by the active client.
 * Throws/redirects if not.
 */
export async function requireClientCampaignOwnership(
  campaignClientId: string | null | undefined,
  redirectPath: string
): Promise<string> {
  const { clientId } = await resolveClientOrg(redirectPath);

  if (!clientId || !campaignClientId || campaignClientId !== clientId) {
    redirect("/unauthorized?reason=membership");
  }

  return clientId;
}
