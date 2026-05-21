import Link from "next/link"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { resolveAuthorizedScope } from "@/lib/auth/authorization"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

export default async function AdminPage() {
  const scope = await resolveAuthorizedScope()

  if (!scope.actor) {
    redirect("/login?next=/admin")
  }
  if (!scope.isPlatformAdmin) {
    redirect("/unauthorized")
  }

  const db = createAdminClient()

  // Admin-portal-triggered actions live in audit_events under these
  // event types. See logAuditEvent calls in src/app/actions/staff-users.ts,
  // user-management.ts, and (dashboard)/admin/actions.ts.
  const ADMIN_EVENT_TYPES = [
    "staff_user.role_changed",
    "staff_user.otp_resent",
    "staff_user.force_signed_out",
    "staff_user.active_state_changed",
    "staff_user.deleted",
    "staff_user.deletion_scheduled",
    "staff_invite.created",
    "staff_invite.resent",
    "staff_invite.revoked",
    "partner_membership.created",
    "partner_membership.role_changed",
    "partner_membership.revoked",
    "client_membership.created",
    "client_membership.role_changed",
    "client_membership.revoked",
  ]

  const [
    { count: profileCount },
    { count: pendingDeletionCount },
    { data: recentDeletions },
    { data: recentAdminActions },
  ] = await Promise.all([
    db.from("profiles").select("*", { count: "exact", head: true }),
    db
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .not("scheduled_deletion_at", "is", null),
    db
      .from("account_deletion_audit")
      .select("email, deleted_at, reason")
      .order("deleted_at", { ascending: false })
      .limit(5),
    db
      .from("audit_events")
      .select("event_type, created_at, target_id, metadata")
      .in("event_type", ADMIN_EVENT_TYPES)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const build = {
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0] ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    env: process.env.VERCEL_ENV ?? "development",
    region: process.env.VERCEL_REGION ?? "local",
    deployedAt: process.env.VERCEL_DEPLOYMENT_CREATED_AT ?? null,
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin"
        description="Platform health, deployment, and operational signals. Visible to platform admins only."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Build</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="font-mono">{build.commitSha}</dd>

              {build.commitMessage ? (
                <>
                  <dt className="text-muted-foreground">Subject</dt>
                  <dd className="truncate">{build.commitMessage}</dd>
                </>
              ) : null}

              {build.branch ? (
                <>
                  <dt className="text-muted-foreground">Branch</dt>
                  <dd className="font-mono">{build.branch}</dd>
                </>
              ) : null}

              <dt className="text-muted-foreground">Environment</dt>
              <dd>
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium">
                  {build.env}
                </span>
              </dd>

              <dt className="text-muted-foreground">Region</dt>
              <dd className="font-mono">{build.region}</dd>

              {build.deployedAt ? (
                <>
                  <dt className="text-muted-foreground">Deployed</dt>
                  <dd>{new Date(build.deployedAt).toLocaleString()}</dd>
                </>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Total profiles</dt>
              <dd className="font-medium">{profileCount ?? 0}</dd>

              <dt className="text-muted-foreground">Pending deletion</dt>
              <dd className="font-medium">{pendingDeletionCount ?? 0}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent admin actions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentAdminActions && recentAdminActions.length > 0 ? (
              <ul className="divide-y divide-border text-sm">
                {recentAdminActions.map((row, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span className="font-mono">{row.event_type}</span>
                    <span className="text-caption text-muted-foreground">
                      {new Date(row.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No admin actions on record yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent account deletions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDeletions && recentDeletions.length > 0 ? (
              <ul className="divide-y divide-border text-sm">
                {recentDeletions.map((row, i) => (
                  <li key={i} className="flex items-center justify-between py-2">
                    <span className="font-mono">{row.email}</span>
                    <span className="text-caption text-muted-foreground">
                      {new Date(row.deleted_at).toLocaleString()} · {row.reason}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No deletions on record.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Explore</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Link href="/admin/audit" className="underline">Audit events</Link> — full
            feed of every mutating action across the platform with filtering.
          </p>
          <p>
            <Link href="/admin/migrations" className="underline">Migrations</Link> —
            schema history as recorded by Supabase.
          </p>
          <p>
            <Link href="/users" className="underline">Users</Link> — user lookup, role
            management, Resend OTP, Force sign out.
          </p>
          <p className="text-caption text-muted-foreground">
            See <code>docs/superpowers/plans/2026-05-21-admin-dashboard.md</code> for the roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
