import { cache } from "react";
import { cookies } from "next/headers";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { resolveAuthorizedScope, AuthenticationRequiredError } from "@/lib/auth/authorization";
import { getWorkspaceContextOptions } from "@/lib/auth/workspace-access";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSurfaceUrl } from "@/lib/hosts";
import type { PortalType } from "@/components/portal-context";
import type { WorkspaceBootstrap, SupportSessionInfo } from "@/lib/auth/types";
import type { Surface } from "@/lib/surfaces";

function createAnonymousScope(requestSurface: Surface): WorkspaceBootstrap["scope"] {
  return {
    actor: null,
    activeContext: null,
    previewContext: null,
    requestSurface,
    isPlatformAdmin: false,
    isLocalDevelopmentBypass: false,
    partnerIds: [],
    partnerAdminIds: [],
    clientIds: [],
    clientAdminIds: [],
    supportSession: null,
  };
}

async function resolveSupportSessionInfo(
  actor: NonNullable<WorkspaceBootstrap["actor"]>,
  portal: PortalType
): Promise<SupportSessionInfo | null> {
  if (portal === "admin") return null;

  const supportSessionId = actor.activeContext?.supportSessionId;
  if (!supportSessionId || actor.role !== "platform_admin") return null;

  const db = createAdminClient();
  const { data: session } = await db
    .from("support_sessions")
    .select("id, target_surface, partner_id, client_id")
    .eq("id", supportSessionId)
    .eq("actor_profile_id", actor.id)
    .is("ended_at", null)
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!session) return null;

  const targetSurface = session.target_surface as "client" | "partner";
  if (targetSurface !== portal) return null;

  const tenantId =
    targetSurface === "partner"
      ? String(session.partner_id)
      : String(session.client_id);

  const table = targetSurface === "partner" ? "partners" : "clients";
  const { data: tenant } = await db
    .from(table)
    .select("name, slug")
    .eq("id", tenantId)
    .single();

  if (!tenant) return null;

  const adminPath =
    targetSurface === "client"
      ? `/clients/${tenant.slug}/overview`
      : `/partners/${tenant.slug}/edit`;

  const adminUrl = buildSurfaceUrl("admin", adminPath);

  return {
    sessionId: String(session.id),
    tenantName: String(tenant.name),
    tenantType: targetSurface,
    actorName: actor.displayName ?? actor.email,
    returnUrl: adminUrl?.toString() ?? "/",
  };
}

export const getWorkspaceBootstrap = cache(
  async (portal: PortalType): Promise<WorkspaceBootstrap> => {
    const [cookieStore, { routePrefix, isLocalDev }] = await Promise.all([
      cookies(),
      getWorkspaceRequestContext(portal),
    ]);

    const sidebarDefaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

    try {
      const scope = await resolveAuthorizedScope();
      const [brandConfig, workspaceContextOptions] = await Promise.all([
        getCachedEffectiveBrand(),
        portal === "admin" ? Promise.resolve([]) : getWorkspaceContextOptions(portal),
      ]);

      const supportSessionInfo =
        scope.actor && portal !== "admin"
          ? await resolveSupportSessionInfo(scope.actor, portal)
          : null;

      return {
        actor: scope.actor,
        scope,
        portal,
        routePrefix,
        isLocalDev,
        sidebarDefaultOpen,
        workspaceContextOptions,
        brandConfig,
        supportSessionInfo,
      };
    } catch (error) {
      if (!(error instanceof AuthenticationRequiredError)) {
        throw error;
      }

      return {
        actor: null,
        scope: createAnonymousScope(portal),
        portal,
        routePrefix,
        isLocalDev,
        sidebarDefaultOpen,
        workspaceContextOptions: [],
        brandConfig: await getCachedEffectiveBrand(),
        supportSessionInfo: null,
      };
    }
  }
);
