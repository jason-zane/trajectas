import { redirect } from "next/navigation";
import { resolveWorkspaceAccess } from "@/lib/auth/workspace-access";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Resolves the active client organization ID for client portal pages.
 *
 * Handles three cases:
 * 1. Active context has a tenantId → use it
 * 2. Local dev bypass with no context → auto-select first org
 * 3. No access → redirect to login or unauthorized
 */
export async function resolveClientOrg(
  redirectPath: string
): Promise<{ orgId: string; access: Awaited<ReturnType<typeof resolveWorkspaceAccess>> }> {
  const access = await resolveWorkspaceAccess("client");

  if (access.status === "signed_out") {
    redirect(`/login?next=${encodeURIComponent(redirectPath)}`);
  }
  if (access.status !== "ok") {
    redirect("/unauthorized");
  }

  // Try active context first
  let orgId = access.activeContext?.tenantId;

  // Local dev bypass without a selected org — auto-select first available
  if (!orgId && access.isLocalDevelopmentBypass) {
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

  return { orgId, access };
}
