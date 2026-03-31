import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceShell } from "@/components/workspace-shell";
import { resolveAdminWorkspaceAccess } from "@/lib/auth/workspace-access";
import { getWorkspaceRequestContext } from "@/lib/workspace-request";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const [{ routePrefix, isLocalDev }, adminAccess] = await Promise.all([
    getWorkspaceRequestContext("admin"),
    resolveAdminWorkspaceAccess(),
  ]);

  if (adminAccess.status !== "ok") {
    if (adminAccess.status === "signed_out") {
      redirect("/login?next=/");
    }

    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <EmptyState
          title={
            "This surface is restricted to platform admin"
          }
          description={
            "Your current actor is authenticated, but it does not have permission to enter the platform admin surface."
          }
          className="w-full"
        />
      </div>
    );
  }

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
