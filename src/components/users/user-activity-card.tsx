import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatAuditEvent } from "@/lib/audit/format-event"
import type { UserActivityItem } from "@/lib/dal/audit"

interface UserActivityCardProps {
  events: UserActivityItem[]
}

export function UserActivityCard({ events }: UserActivityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <ul className="divide-y divide-border">
            {events.map((event) => {
              const formatted = formatAuditEvent({
                eventType: event.eventType,
                metadata: event.metadata,
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
                    dateTime={event.createdAt}
                  >
                    {new Date(event.createdAt).toLocaleString()}
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
