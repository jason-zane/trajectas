import type { Metadata } from "next";
import { cookies } from "next/headers";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const { routePrefix, isLocalDev } = await getWorkspaceRequestContext("client");

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell
        defaultOpen={defaultOpen}
        portal="client"
        routePrefix={routePrefix}
        canSwitchPortal={isLocalDev}
      >
        {children}
      </WorkspaceShell>
    </SessionActivityProvider>
  );
}
