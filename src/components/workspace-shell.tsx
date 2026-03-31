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
import { getEffectiveBrand } from "@/app/actions/brand";
import { getWorkspaceContextOptions } from "@/lib/auth/workspace-access";
import { resolveSessionActor } from "@/lib/auth/actor";
import { generateDashboardCSS } from "@/lib/brand/tokens";

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

  return (
    <PortalProvider
      initialPortal={portal}
      routePrefix={routePrefix}
      canSwitchPortal={canSwitchPortal}
    >
      <style dangerouslySetInnerHTML={{ __html: dashboardCSS }} />
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
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
