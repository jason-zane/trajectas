import { CalendarClock, Link2 } from "lucide-react";
import { AcceptInviteForm } from "@/app/auth/accept/accept-invite-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getInviteSummaryByToken } from "@/lib/auth/staff-auth";

function formatRole(role: string) {
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string; next?: string; email?: string; step?: string }>;
}) {
  const { invite = "", next, email, step } = await searchParams;
  const summary = invite ? await getInviteSummaryByToken(invite) : null;
  const expired =
    !summary ||
    Boolean(summary.revokedAt) ||
    Boolean(summary.acceptedAt) ||
    summary.isExpired;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6 py-16">
      <Card className="w-full border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle>Accept staff invite</CardTitle>
          <CardDescription>
            {expired
              ? "This invite is no longer valid."
              : "Use the invited email account to receive a secure sign-in link."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {expired ? (
            <p className="text-sm text-muted-foreground">
              Ask a platform admin to issue a fresh invite if you still need access.
            </p>
          ) : (
            <>
              <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-4 text-sm">
                <div className="flex items-center gap-2 text-foreground">
                  <Link2 className="size-4 text-primary" />
                  <span className="font-medium">{summary.email}</span>
                </div>
                <div className="grid gap-1 text-muted-foreground">
                  <p>Role: {formatRole(summary.role)}</p>
                  <p>
                    Scope: {summary.tenantType === "platform" ? "Platform admin" : `${summary.tenantType} access`}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="size-4" />
                  <span>Expires {new Date(summary.expiresAt).toLocaleString()}</span>
                </div>
              </div>
              <AcceptInviteForm
                inviteToken={invite}
                nextPath={next}
                initialEmail={email}
                initialStep={step === "code" ? "code" : "email"}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
