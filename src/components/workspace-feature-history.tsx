import type { WorkspaceFeatureHistoryItem } from '@/lib/dal/workspace-features'
import { INSIGHT_FEATURES, MODULE_FEATURES } from '@/lib/features/workspace-features'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { formatDateTime } from '@/lib/formatting'
export function WorkspaceFeatureHistory({ history }: { history: WorkspaceFeatureHistoryItem[] }) {
  return <Card><CardHeader><CardTitle>Feature change history</CardTitle><CardDescription>Latest 20 audited changes, including preset applications and individual overrides.</CardDescription></CardHeader>
    <CardContent>{history.length ? <ol className="space-y-4">{history.map(event => <li key={event.id} className="space-y-1 border-b border-border pb-4 last:border-0">
      <p className="text-sm font-medium">{formatDateTime(event.createdAt)} · {event.origin}</p>
      <p className="text-xs text-muted-foreground">Administrator: {event.actorId ?? 'Historical actor unavailable'}</p>
      <ul className="text-sm">{event.changes.map(change => <li key={change.key}>{[...INSIGHT_FEATURES, ...MODULE_FEATURES].find(feature => feature.key === change.key)?.label ?? 'Dashboard style'}: {change.before === null ? 'Not recorded' : String(change.before)} → {String(change.after)}</li>)}</ul>
    </li>)}</ol> : <p className="text-sm text-muted-foreground">No feature changes have been recorded.</p>}</CardContent>
  </Card>
}
