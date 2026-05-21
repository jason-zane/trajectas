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
      .from("admin_action_audit")
      .select("action, created_at, target_profile_id, payload")
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
                    <span className="font-mono">{row.action}</span>
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

      <p className="text-caption text-muted-foreground">
        User triage actions (resend OTP, etc.) live on each user&apos;s detail page under{" "}
        <Link href="/users" className="underline">/users</Link>. See{" "}
        <code>docs/superpowers/plans/2026-05-21-admin-dashboard.md</code> for the roadmap.
      </p>
    </div>
  )
}
