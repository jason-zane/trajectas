import { Database } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { ScrollReveal } from "@/components/scroll-reveal"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

interface MigrationRow {
  version: string
  name: string | null
}

function formatVersionAsDate(version: string): string {
  // Versions are timestamps like 20260522020000 → 2026-05-22 02:00:00
  if (version.length < 14 || !/^\d+$/.test(version)) return version
  const y = version.slice(0, 4)
  const m = version.slice(4, 6)
  const d = version.slice(6, 8)
  const hh = version.slice(8, 10)
  const mm = version.slice(10, 12)
  return `${y}-${m}-${d} ${hh}:${mm}`
}

export default async function SettingsMigrationsPage() {
  const db = createAdminClient()
  // RPC call (see migration 20260522020000) — needed because the
  // supabase_migrations schema isn't exposed via PostgREST so we can't
  // use db.schema("supabase_migrations").
  const { data, error } = await db.rpc("admin_list_migrations")
  const migrations = (data ?? []) as MigrationRow[]

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Migrations"
        description="Schema history as recorded by Supabase. Newest first; capped at 200."
      />

      <ScrollReveal>
        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Failed to load migrations: {error.message}
            </CardContent>
          </Card>
        ) : migrations.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {migrations.map((m) => (
                  <li
                    key={m.version}
                    className="flex items-center justify-between gap-6 px-5 py-3 hover:bg-muted/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Database className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{m.name ?? "—"}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                        {m.version}
                      </code>
                      <span className="text-caption text-muted-foreground">
                        {formatVersionAsDate(m.version)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No migrations recorded.
            </CardContent>
          </Card>
        )}
      </ScrollReveal>
    </div>
  )
}
