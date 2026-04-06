"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminScope } from "@/lib/auth/authorization";
import { startSupportSession } from "@/lib/auth/support-sessions";
import { buildSurfaceUrl } from "@/lib/hosts";
import type { Surface } from "@/lib/surfaces";

/**
 * Creates a support session and returns the launch URL for the target portal.
 * Uses existing support session infrastructure.
 */
export async function createEnterPortalLaunchUrl(input: {
  tenantType: "client" | "partner";
  tenantId: string;
}): Promise<{ success: true; launchUrl: string } | { error: string }> {
  try {
    const scope = await requireAdminScope();

    if (!scope.actor) {
      return { error: "Actor not found." };
    }

    const session = await startSupportSession({
      actorProfileId: scope.actor.id,
      targetSurface: input.tenantType satisfies Extract<Surface, "partner" | "client">,
      targetTenantId: input.tenantId,
      reason: "Admin portal access",
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
    });

    const launchPath = `/${input.tenantType}/support/launch`;
    const launchSearch = `sessionId=${session.id}&sessionKey=${session.sessionKey}`;

    // Try host-based URL first (production), fall back to path-based (local dev)
    const surfaceUrl = buildSurfaceUrl(input.tenantType, launchPath, launchSearch);
    const launchUrl = surfaceUrl
      ? surfaceUrl.toString()
      : `${launchPath}?${launchSearch}`;

    return { success: true, launchUrl };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to create portal session.",
    };
  }
}

/**
 * Ends an active support session by setting ended_at to now.
 */
export async function endSupportSession(
  sessionId: string
): Promise<{ success: true } | { error: string }> {
  try {
    await requireAdminScope();

    const db = createAdminClient();
    const { error } = await db
      .from("support_sessions")
      .update({ ended_at: new Date().toISOString() })
      .eq("id", sessionId);

    if (error) {
      return { error: error.message };
    }

    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Failed to end support session.",
    };
  }
}
