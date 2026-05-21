import { Filter, Activity } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/scroll-reveal"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatAuditEvent } from "@/lib/audit/format-event"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 100

interface AuditPageProps {
  searchParams: Promise<{ q?: string; actor?: string }>
}

export default async function SettingsAuditPage({ searchParams }: AuditPageProps) {
  const { q, actor } = await searchParams
  const eventQuery = q?.trim() ?? ""
  const actorQuery = actor?.trim() ?? ""

  const db = createAdminClient()
  let request = db
    .from("audit_events")
    .select("id, actor_profile_id, event_type, target_table, target_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  if (eventQuery) request = request.ilike("event_type", `%${eventQuery}%`)
  if (actorQuery) request = request.eq("actor_profile_id", actorQuery)

  const { data: events, error } = await request

  const filtersApplied = Boolean(eventQuery || actorQuery)

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="Audit log"
        description="Every mutating action recorded across the platform. Newest first; capped at 100 per page. Filter by event-type substring or actor profile UUID."
      />

      <ScrollReveal>
        <Card>
          <CardContent className="space-y-4 py-5">
            <form className="flex flex-col gap-3 sm:flex-row" method="get">
              <div className="flex-1">
                <Input
                  name="q"
                  defaultValue={eventQuery}
                  placeholder="Event type contains… (e.g. campaign.created)"
                  autoComplete="off"
                />
              </div>
              <div className="flex-1">
                <Input
                  name="actor"
                  defaultValue={actorQuery}
                  placeholder="Actor profile UUID (exact match)"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" size="sm" variant="outline">
                <Filter className="size-4" />
                Apply
              </Button>
              {filtersApplied ? (
                <a
                  href="/settings/audit"
                  className="inline-flex items-center justify-center rounded-md px-3 text-sm text-muted-foreground hover:text-foreground"
                >
                  Clear
                </a>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </ScrollReveal>

      <ScrollReveal delay={80}>
        {error ? (
          <Card>
            <CardContent className="py-6 text-sm text-destructive">
              Failed to load events: {error.message}
            </CardContent>
          </Card>
        ) : events && events.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {events.map((event) => {
                  const formatted = formatAuditEvent({
                    eventType: event.event_type,
                    metadata: event.metadata as Record<string, unknown> | null,
                  })
                  return (
                    <li
                      key={event.id}
                      className="flex items-start justify-between gap-6 px-5 py-3.5 hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Activity className="size-3.5 shrink-0 text-muted-foreground" />
                          <p className="truncate text-sm font-medium">{formatted.title}</p>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {event.event_type}
                          </code>
                        </div>
                        <div className="ml-5.5 mt-1 text-caption text-muted-foreground">
                          {formatted.detail ? <span>{formatted.detail} · </span> : null}
                          {event.target_table ? (
                            <span className="font-mono">
                              {event.target_table}
                              {event.target_id ? ` · ${event.target_id.slice(0, 8)}…` : ""}
                            </span>
                          ) : (
                            <span>—</span>
                          )}
                          {event.actor_profile_id ? (
                            <span> · actor {event.actor_profile_id.slice(0, 8)}…</span>
                          ) : (
                            <span> · system</span>
                          )}
                        </div>
                      </div>
                      <time
                        className="shrink-0 text-caption text-muted-foreground"
                        dateTime={event.created_at}
                      >
                        {new Date(event.created_at).toLocaleString()}
                      </time>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              {filtersApplied ? "No events match your filters." : "No events recorded yet."}
            </CardContent>
          </Card>
        )}
      </ScrollReveal>
    </div>
  )
}
