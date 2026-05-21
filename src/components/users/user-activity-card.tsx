import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatAuditEvent } from "@/lib/audit/format-event"

interface UserActivityCardProps {
  profileId: string
  limit?: number
}

export async function UserActivityCard({ profileId, limit = 10 }: UserActivityCardProps) {
  const db = createAdminClient()
  const { data: events } = await db
    .from("audit_events")
    .select("id, event_type, created_at, metadata, actor_profile_id")
    .eq("target_id", profileId)
    .eq("target_table", "profiles")
    .order("created_at", { ascending: false })
    .limit(limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events && events.length > 0 ? (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const formatted = formatAuditEvent({
                eventType: event.event_type,
                metadata: event.metadata as Record<string, unknown> | null,
              })
              return (
                <li key={event.id} className="flex items-start justify-between gap-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{formatted.title}</p>
                    {formatted.detail ? (
                      <p className="text-caption text-muted-foreground mt-0.5">
                        {formatted.detail}
                      </p>
                    ) : null}
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
        ) : (
          <p className="text-sm text-muted-foreground">
            No recorded activity for this user yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
