import { headers } from "next/headers";
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalProvider } from "@/components/portal-context";
import { DashboardHeader } from "@/components/dashboard-header";
import { PageTransition } from "@/components/page-transition";
import { WorkspaceContextSwitcher } from "@/components/workspace-context-switcher";
import { AccountMenu } from "@/components/auth/account-menu";
import { SupportSessionBanner } from "@/components/support-session-banner";
import { LazyCommandPalette } from "@/components/lazy-command-palette";
import { generateDashboardCSS } from "@/lib/brand/tokens";
import { logSupportSessionPageView } from "@/app/actions/enter-portal";
import { type WorkspaceBootstrap } from "@/lib/auth/types";

interface WorkspaceShellProps {
  children: React.ReactNode;
  bootstrap: WorkspaceBootstrap;
}

export async function WorkspaceShell({
  children,
  bootstrap,
}: WorkspaceShellProps) {
  const {
    actor,
    portal,
    routePrefix,
    isLocalDev,
    sidebarDefaultOpen,
    workspaceContextOptions,
    brandConfig,
    supportSessionInfo,
    scope,
  } = bootstrap;

  // Only client admins (and platform admins) see the Settings area in the
  // client portal. Determined from the active client context; regular members
  // don't get the footer entry.
  const activeClientId =
    scope.activeContext?.tenantType === "client"
      ? scope.activeContext.tenantId ?? null
      : null;
  const canManageClientSettings =
    portal === "client" &&
    (scope.isPlatformAdmin ||
      (activeClientId != null && scope.clientAdminIds.includes(activeClientId)) ||
      (activeClientId == null && scope.clientAdminIds.length > 0));
  const dashboardCSS = generateDashboardCSS(brandConfig);

  if (supportSessionInfo && actor) {
    const headerStore = await headers();
    const requestRoutePrefix = headerStore.get("x-trajectas-route-prefix");
    const path =
      requestRoutePrefix && requestRoutePrefix !== "/" ? requestRoutePrefix : `/${portal}`;

    logSupportSessionPageView(
      supportSessionInfo.sessionId,
      actor.id,
      path
    ).catch(() => {
      // Silently swallow: audit failures must not break page render.
    });
  }

  return (
    <PortalProvider
      initialPortal={portal}
      routePrefix={routePrefix}
      canSwitchPortal={isLocalDev}
    >
      {/* Brand CSS is generated server-side from sanitized config values */}
      <style dangerouslySetInnerHTML={{ __html: dashboardCSS }} />
      <SidebarProvider defaultOpen={sidebarDefaultOpen}>
        <AppSidebar canManageClientSettings={canManageClientSettings} />
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
          <LazyCommandPalette />
        </SidebarInset>
      </SidebarProvider>
    </PortalProvider>
  );
}
