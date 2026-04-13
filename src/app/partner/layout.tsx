import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { SessionActivityProvider } from "@/components/auth/session-activity-provider";
import { SessionExpiryWarning } from "@/components/auth/session-expiry-warning";
import { getWorkspaceBootstrap } from "@/lib/auth/workspace-bootstrap";
import { SentryUserContext } from "@/components/sentry-user-context";

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
      {bootstrap.actor && (
        <SentryUserContext userId={bootstrap.actor.id} email={bootstrap.actor.email} />
      )}
      <SessionExpiryWarning />
      <WorkspaceShell bootstrap={bootstrap}>{children}</WorkspaceShell>
    </SessionActivityProvider>
  );
}
