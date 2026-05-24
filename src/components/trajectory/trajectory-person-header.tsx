'use client'

import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TrajectoryResult } from '@/lib/trajectory/types'

/**
 * Compact one-line header for the Trajectory workspace. The editorial
 * weight ("N sessions, biggest movements are…") sits in the summary
 * panel below; this header just identifies the person and surfaces the
 * linked-records affordance.
 */
export function TrajectoryPersonHeader({
  result,
  onOpenLinkedRecords,
}: {
  result: TrajectoryResult
  onOpenLinkedRecords?: () => void
}) {
  const linkedCount = result.linkedParticipants.length
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1">
      <div className="min-w-0">
        <p className="text-overline text-[var(--gold)]">Person</p>
        <p className="text-sm text-muted-foreground truncate">{result.primaryEmail}</p>
      </div>
      {onOpenLinkedRecords && linkedCount > 1 && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={onOpenLinkedRecords}
        >
          <Link2 className="size-3.5" />
          {linkedCount} linked {linkedCount === 1 ? 'record' : 'records'}
        </Button>
      )}
    </div>
  )
}
