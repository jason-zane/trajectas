import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { EmptyState } from "@/components/empty-state";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bootstrap = await getWorkspaceBootstrap("admin");

  if (!bootstrap.actor && !bootstrap.isLocalDev) {
    redirect("/login?next=/");
  }

  if (!bootstrap.scope.isPlatformAdmin && !bootstrap.isLocalDev) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <EmptyState
          title="This surface is restricted to platform admin"
          description="Your current actor is authenticated, but it does not have permission to enter the platform admin surface."
          className="w-full"
        />
      </div>
    );
  }

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>{children}</WorkspaceShell>
    </SessionActivityProvider>
  );
}
