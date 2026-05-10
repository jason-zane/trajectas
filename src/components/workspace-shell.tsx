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
import { getCachedPlatformBrand } from "@/app/actions/brand";
import { createAdminClient } from "@/lib/supabase/admin";
import { type WorkspaceBootstrap } from "@/lib/auth/types";

async function resolveSidebarIdentity(bootstrap: WorkspaceBootstrap) {
  const platformBrand = await getCachedPlatformBrand();
  const platformName = platformBrand?.config.name ?? "Trajectas";
  const platformLogomarkUrl = platformBrand?.config.logomarkUrl ?? null;
  const empty = {
    tenantName: null,
    tenantLogomarkUrl: null,
    platformName,
    platformLogomarkUrl,
  };

  if (bootstrap.portal === "admin") return empty;

  const selected =
    bootstrap.workspaceContextOptions.find((o) => o.selected) ??
    bootstrap.workspaceContextOptions[0];

  if (!selected?.tenantId || !selected?.tenantType) return empty;

  const db = createAdminClient();
  const [{ data: tenant }, { data: tenantBrand }] = await Promise.all([
    db
      .from(selected.tenantType === "partner" ? "partners" : "clients")
      .select("name")
      .eq("id", selected.tenantId)
      .maybeSingle(),
    db
      .from("brand_configs")
      .select("config")
      .eq("owner_type", selected.tenantType)
      .eq("owner_id", selected.tenantId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  const brandConfig = tenantBrand?.config as
    | { logomarkUrl?: string }
    | null
    | undefined;

  return {
    tenantName: (tenant?.name as string | undefined) ?? selected.label,
    tenantLogomarkUrl: brandConfig?.logomarkUrl ?? null,
    platformName,
    platformLogomarkUrl,
  };
}

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
  } = bootstrap;
  const dashboardCSS = generateDashboardCSS(brandConfig);
  const identity = await resolveSidebarIdentity(bootstrap);

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
        <AppSidebar identity={identity} />
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
              portal === "admin" || workspaceContextOptions.length <= 1 ? null : (
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
