import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 100

interface AuditPageProps {
  searchParams: Promise<{ q?: string; actor?: string }>
}

export default async function AdminAuditPage({ searchParams }: AuditPageProps) {
  const { q, actor } = await searchParams
  const eventQuery = q?.trim() ?? ""
  const actorQuery = actor?.trim() ?? ""

  const db = createAdminClient()
  let request = db
    .from("audit_events")
    .select("id, actor_profile_id, event_type, target_table, target_id, created_at, metadata")
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE)

  if (eventQuery) {
    request = request.ilike("event_type", `%${eventQuery}%`)
  }
  if (actorQuery) {
    request = request.eq("actor_profile_id", actorQuery)
  }

  const { data: events, error } = await request

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit events"
        description="Every mutating action across the platform. Most recent 100 shown. Filter by event type or actor profile ID."
      />

      <form className="flex max-w-2xl gap-3" method="get">
        <Input
          name="q"
          defaultValue={eventQuery}
          placeholder="Event type contains… (e.g. campaign.created)"
          autoComplete="off"
        />
        <Input
          name="actor"
          defaultValue={actorQuery}
          placeholder="Actor profile ID (exact UUID)"
          autoComplete="off"
        />
      </form>

      {error ? (
        <Card>
          <CardContent className="py-6 text-sm text-destructive">
            Failed to load events: {error.message}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">When</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead className="w-[180px]">Actor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events?.length ? (
                  events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-caption text-muted-foreground">
                        {new Date(e.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono">{e.event_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.target_table ? (
                          <>
                            {e.target_table}
                            {e.target_id ? ` · ${e.target_id.slice(0, 8)}…` : ""}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.actor_profile_id ? `${e.actor_profile_id.slice(0, 8)}…` : "system"}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No events match.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
