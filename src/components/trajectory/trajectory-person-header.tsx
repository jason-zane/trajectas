'use client'

import { Users, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TrajectoryResult } from '@/lib/trajectory/types'

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

export function TrajectoryPersonHeader({
  result,
  onOpenLinkedRecords,
}: {
  result: TrajectoryResult
  onOpenLinkedRecords?: () => void
}) {
  const linkedCount = result.linkedParticipants.length
  const sessionCount = result.linkedParticipants.reduce(
    (acc, p) => acc + p.completedSessionCount,
    0,
  )

  // Date range across all loaded points
  let earliest: string | undefined
  let latest: string | undefined
  for (const series of result.series) {
    for (const point of series.points) {
      if (!earliest || point.completedAt < earliest) earliest = point.completedAt
      if (!latest || point.completedAt > latest) latest = point.completedAt
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Person</div>
        <h3 className="text-lg font-semibold">{result.displayName}</h3>
        <p className="text-sm text-muted-foreground">{result.primaryEmail}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
          <Users className="size-3.5 opacity-60" />
          {linkedCount} {linkedCount === 1 ? 'record' : 'records'}
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs">
          <Calendar className="size-3.5 opacity-60" />
          {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
        </div>
        {(earliest || latest) && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
            {formatDate(earliest)} → {formatDate(latest)}
          </div>
        )}
        {onOpenLinkedRecords && linkedCount > 1 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={onOpenLinkedRecords}
          >
            View linked records
          </Button>
        )}
      </div>
    </div>
  )
}
