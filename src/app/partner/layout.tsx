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

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const bootstrap = await getWorkspaceBootstrap("partner");

  if (!bootstrap.actor && !bootstrap.isLocalDev) {
    redirect("/login?next=/partner");
  }

  return (
    <SessionActivityProvider>
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>{children}</WorkspaceShell>
    </SessionActivityProvider>
  );
}
