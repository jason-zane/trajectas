import { cookies } from "next/headers";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { PortalProvider } from "@/components/portal-context";
import { DashboardHeader } from "@/components/dashboard-header";
import { CommandPalette } from "@/components/command-palette";
import { PageTransition } from "@/components/page-transition";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <PortalProvider>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <div className="ambient-glow" />
          <a href="#main-content" className="skip-to-content">Skip to content</a>
          <DashboardHeader />
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
