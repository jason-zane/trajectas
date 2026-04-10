import { getParticipantResponses } from "@/app/actions/participants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";

interface SessionResponsesPanelProps {
  sessionId: string;
}

export async function SessionResponsesPanel({ sessionId }: SessionResponsesPanelProps) {
  const groups = await getParticipantResponses(sessionId);

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No responses yet"
        description="Item responses will appear here once the session is in progress."
      />
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.sectionId}>
          <CardHeader>
            <CardTitle className="text-base">{group.sectionTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.itemId}
                  className="flex items-start justify-between gap-4 border-t border-border/50 pt-3 first:border-t-0 first:pt-0"
                >
                  <p className="text-sm flex-1">{item.stem}</p>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {item.responseValue ?? "—"}
                    </p>
                    {item.responseTimeMs != null && (
                      <p className="text-caption text-muted-foreground">
                        {(item.responseTimeMs / 1000).toFixed(1)}s
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
