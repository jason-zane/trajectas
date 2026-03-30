import { cookies } from "next/headers";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const { routePrefix, isLocalDev } = await getWorkspaceRequestContext("admin");

  return (
    <WorkspaceShell
      defaultOpen={defaultOpen}
      portal="admin"
      routePrefix={routePrefix}
      canSwitchPortal={isLocalDev}
    >
      {children}
    </WorkspaceShell>
  );
}
