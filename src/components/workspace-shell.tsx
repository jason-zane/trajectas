import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalProvider, type PortalType } from "@/components/portal-context";
import { DashboardHeader } from "@/components/dashboard-header";
import { CommandPalette } from "@/components/command-palette";
import { PageTransition } from "@/components/page-transition";
import { WorkspaceContextSwitcher } from "@/components/workspace-context-switcher";
import { AccountMenu } from "@/components/auth/account-menu";
import { SupportSessionBanner } from "@/components/support-session-banner";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getWorkspaceContextOptions } from "@/lib/auth/workspace-access";
import { resolveSessionActor } from "@/lib/auth/actor";
import { generateDashboardCSS } from "@/lib/brand/tokens";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildSurfaceUrl } from "@/lib/hosts";
import { headers } from "next/headers";
import { logSupportSessionPageView } from "@/app/actions/enter-portal";
import type { ResolvedActor } from "@/lib/auth/types";

interface SupportSessionInfo {
  sessionId: string;
  tenantName: string;
  tenantType: "client" | "partner";
  actorName: string;
  returnUrl: string;
}

async function resolveSupportSessionInfo(
  actor: ResolvedActor,
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

interface WorkspaceShellProps {
  children: React.ReactNode;
  defaultOpen: boolean;
  portal: PortalType;
  routePrefix?: string;
  canSwitchPortal?: boolean;
}

export async function WorkspaceShell({
  children,
  defaultOpen,
  portal,
  routePrefix = "",
  canSwitchPortal = false,
}: WorkspaceShellProps) {
  const [brandConfig, workspaceContextOptions, actor] = await Promise.all([
    getEffectiveBrand(),
    portal === "admin" ? Promise.resolve([]) : getWorkspaceContextOptions(portal),
    resolveSessionActor(),
  ]);
  const dashboardCSS = generateDashboardCSS(brandConfig);

  const supportSessionInfo =
    actor && portal !== "admin"
      ? await resolveSupportSessionInfo(actor, portal)
      : null;

  if (supportSessionInfo && actor) {
    // Derive the current path from request headers (Next.js App Router
    // makes the x-trajectas-route-prefix available from the middleware
    // rewrite; fall back to the portal name as a coarse-grained label).
    const headerStore = await headers();
    const requestRoutePrefix = headerStore.get("x-trajectas-route-prefix");
    const path =
      requestRoutePrefix && requestRoutePrefix !== "/" ? requestRoutePrefix : `/${portal}`;

    // Fire-and-forget: audit failure must not break page render.
    logSupportSessionPageView(
      supportSessionInfo.sessionId,
      actor.id,
      path
    ).catch(() => {
      // Silently swallow — logSupportSessionPageView already logs internally.
    });
  }

  return (
    <PortalProvider
      initialPortal={portal}
      routePrefix={routePrefix}
      canSwitchPortal={canSwitchPortal}
    >
      {/* Brand CSS is generated server-side from sanitized config values */}
      <style dangerouslySetInnerHTML={{ __html: dashboardCSS }} />
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          {supportSessionInfo && (
            <SupportSessionBanner
              sessionId={supportSessionInfo.sessionId}
              tenantName={supportSessionInfo.tenantName}
              tenantType={supportSessionInfo.tenantType}
              actorName={supportSessionInfo.actorName}
              returnUrl={supportSessionInfo.returnUrl}
            />
          )}
          <div className="ambient-glow" />
          <a href="#main-content" className="skip-to-content">
            Skip to content
          </a>
          <DashboardHeader
            accountControl={
              actor ? (
                <AccountMenu
                  email={actor.email}
                  displayName={actor.displayName}
                />
              ) : null
            }
            workspaceControls={
              portal === "admin" || workspaceContextOptions.length === 0 ? null : (
                <WorkspaceContextSwitcher
                  surface={portal}
                  options={workspaceContextOptions}
                />
              )
            }
          />
          <main id="main-content" className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
            <div className="mx-auto max-w-7xl">
              <PageTransition>{children}</PageTransition>
            </div>
          </main>
          <CommandPalette />
        </SidebarInset>
      </SidebarProvider>
    </PortalProvider>
  );
}
