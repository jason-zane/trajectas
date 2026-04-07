"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminScope } from "@/lib/auth/authorization";
import { logAuditEvent, startSupportSession } from "@/lib/auth/support-sessions";
import { buildSurfaceUrl } from "@/lib/hosts";
import { logActionError } from "@/lib/security/action-errors";
import type { Surface } from "@/lib/surfaces";

// ---------------------------------------------------------------------------
// Page-level audit logging for support session data access
// ---------------------------------------------------------------------------

const PAGE_VIEW_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes

type PageViewDebounceStore = Map<string, number>;

function getPageViewDebounceStore(): PageViewDebounceStore {
  const g = globalThis as typeof globalThis & {
    __trajectasSupportPageViewStore?: PageViewDebounceStore;
  };
  if (!g.__trajectasSupportPageViewStore) {
    g.__trajectasSupportPageViewStore = new Map();
  }
  return g.__trajectasSupportPageViewStore;
}

/**
 * Logs a `support_session.data_accessed` event for each unique
 * (sessionId, path) pair, debounced to once per 5 minutes.
 *
 * Called from WorkspaceShell when a support session is active.
 */
export async function logSupportSessionPageView(
  sessionId: string,
  actorId: string,
  path: string
): Promise<void> {
  const store = getPageViewDebounceStore();
  const key = `${sessionId}:${path}`;
  const now = Date.now();
  const lastLoggedAt = store.get(key) ?? 0;

  if (now - lastLoggedAt < PAGE_VIEW_DEBOUNCE_MS) {
    return;
  }

  store.set(key, now);

  // Evict stale entries to prevent unbounded growth.
  if (store.size > 512) {
    const cutoff = now - PAGE_VIEW_DEBOUNCE_MS;
    for (const [k, ts] of store.entries()) {
      if (ts < cutoff) store.delete(k);
    }
  }

  try {
    await logAuditEvent({
      actorProfileId: actorId,
      eventType: "support_session.data_accessed",
      supportSessionId: sessionId,
      metadata: { path },
    });
  } catch (err) {
    logActionError("logSupportSessionPageView.audit", err);
  }
}

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

    if (input.tenantType === "client") {
      try {
        await logAuditEvent({
          actorProfileId: scope.actor.id,
          eventType: "client.portal_entered",
          targetTable: "clients",
          targetId: input.tenantId,
          clientId: input.tenantId,
          supportSessionId: session.id,
          metadata: {
            source: "admin_enter_portal",
          },
        });
      } catch (auditError) {
        logActionError("createEnterPortalLaunchUrl.audit", auditError);
      }
    }

    return { success: true, launchUrl };
  } catch (err) {
    logActionError("createEnterPortalLaunchUrl", err);
    return {
      error: "Failed to create portal session.",
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
      logActionError("endSupportSession.update", error);
      return { error: "Failed to end support session." };
    }

    return { success: true };
  } catch (err) {
    logActionError("endSupportSession", err);
    return {
      error: "Failed to end support session.",
    };
  }
}
