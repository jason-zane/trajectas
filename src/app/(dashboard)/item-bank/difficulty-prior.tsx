/**
 * The single UI treatment for difficulty in the item bank admin (LR-8 / #347).
 *
 * ---------------------------------------------------------------------------
 * WHY THIS COMPONENT EXISTS INSTEAD OF `{item.difficultyPriorB.toFixed(2)}`
 * ---------------------------------------------------------------------------
 * Every difficulty number on this surface is the output of the rule-based
 * radical model: out-of-sample R² ~0.43, with ~28% of the variance sitting
 * BETWEEN CLONES that are identical on every modelled radical. It is what the
 * design predicts before anyone has answered the item. It is not a measurement,
 * and a reviewer who reads it as one will over-trust a number that is wrong
 * about a quarter of the time for reasons the model cannot see.
 *
 * Calibrated difficulty is a different thing entirely, lives in
 * `item_parameters`, and only exists after piloting.
 *
 * #347's constraint is that the reviewer-visible difficulty must be labelled a
 * design prior wherever it appears. Routing every number through this file is
 * how that is kept true as screens get added: there is no path to rendering a
 * difficulty on this surface that does not carry the marker, because there is
 * no other formatter.
 */

import { Info } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { difficultyPriorBandLabel, formatDifficultyPriorB } from './lifecycle-display'

/** Used as the `title` on compact renderings where a full note does not fit. */
const PRIOR_TOOLTIP =
  'Design prior, not a measured value. Rule-based radical model, out-of-sample R² ~0.43; ~28% of variance sits between clones identical on every modelled radical. Calibrated difficulty exists only after piloting.'

/**
 * A difficulty prior value with its permanent "prior" marker.
 *
 * The marker is part of the value, not decoration next to it — that is what
 * survives a column being copied into a new table by a future author.
 */
export function DifficultyPriorValue({
  value,
  band,
  className,
}: {
  value: number | null
  band?: string | null
  className?: string
}) {
  const hasValue = value !== null && !Number.isNaN(value)
  return (
    <span className={cn('inline-flex items-baseline gap-1.5', className)} title={PRIOR_TOOLTIP}>
      <span className="font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        prior
      </span>
      <span className="tabular-nums font-medium">{formatDifficultyPriorB(value)}</span>
      {band ? (
        <span className="text-caption text-muted-foreground">
          {difficultyPriorBandLabel(band)}
        </span>
      ) : null}
      {!hasValue && !band ? <span className="sr-only">No difficulty prior recorded</span> : null}
    </span>
  )
}

/** Band-only rendering, for distribution chips and table cells with no logit. */
export function DifficultyPriorBandBadge({ band }: { band: string | null }) {
  return (
    <Badge variant="outline" title={PRIOR_TOOLTIP} className="gap-1">
      <span className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-muted-foreground">
        prior
      </span>
      {difficultyPriorBandLabel(band)}
    </Badge>
  )
}

/**
 * The full disclosure. Placed once on every screen that shows a difficulty
 * number, near the numbers rather than in a footer, so it is read before the
 * value is trusted.
 */
export function DifficultyPriorNote({ className }: { className?: string }) {
  return (
    <Alert variant="info" className={className}>
      <Info />
      <AlertTitle>Difficulty here is a design prior, not a measurement</AlertTitle>
      <AlertDescription>
        These values come from the rule-based radical model and describe what the design predicts
        before anyone has answered the item. Out-of-sample R² is approximately 0.43, and about 28%
        of the variance sits between clones that are identical on every modelled radical — so two
        items sharing a prior can differ substantially in practice. Calibrated difficulty is a
        separate, measured quantity that exists only after piloting.
      </AlertDescription>
    </Alert>
  )
}

/**
 * A band distribution bar. Counts are design-prior bands, so the whole block
 * is labelled once rather than each segment.
 */
export function DifficultyPriorBandDistribution({
  counts,
  className,
}: {
  counts: Record<string, number>
  className?: string
}) {
  const entries = Object.entries(counts).filter(([, n]) => n > 0)
  const total = entries.reduce((sum, [, n]) => sum + n, 0)

  if (total === 0) {
    return (
      <p className={cn('text-caption text-muted-foreground', className)}>
        No banded items — nothing in this set carries a difficulty prior.
      </p>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Difficulty prior bands
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([band, count]) => (
          <Badge key={band} variant="outline" className="gap-1.5" title={PRIOR_TOOLTIP}>
            {difficultyPriorBandLabel(band)}
            <span className="tabular-nums font-semibold">{count}</span>
          </Badge>
        ))}
      </div>
    </div>
  )
}
