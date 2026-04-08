import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";

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
  const bootstrap = await getWorkspaceBootstrap("client");

  if (!bootstrap.actor && !bootstrap.isLocalDev) {
    redirect("/login?next=/client");
  }

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>{children}</WorkspaceShell>
    </SessionActivityProvider>
  );
}
