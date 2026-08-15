/**
 * Presentational building blocks shared by the item bank screens.
 *
 * No `'use client'`: these render on the server and take plain primitives, so
 * they can sit inside a key-bearing server component without pulling anything
 * into the browser bundle.
 */

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { LIFECYCLE_ORDER, lifecycleDisplay, lifecycleToneClass } from './lifecycle-display'

export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: string
  value: string | number
  hint?: string
  className?: string
}) {
  return (
    <Card className={cn('gap-1 p-4', className)}>
      <p className="font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint ? <p className="text-caption text-muted-foreground">{hint}</p> : null}
    </Card>
  )
}

/**
 * Lifecycle counts in pipeline order. States with a zero count are dropped —
 * a bank that has never been reviewed should read as "412 draft", not as a
 * wall of zeroes that hides where the items actually are.
 */
export function LifecycleBreakdown({
  counts,
  className,
  emptyMessage = 'No items.',
}: {
  counts: Record<string, number>
  className?: string
  emptyMessage?: string
}) {
  const known = LIFECYCLE_ORDER.filter((state) => (counts[state] ?? 0) > 0)
  const unknown = Object.keys(counts)
    .filter((state) => !(LIFECYCLE_ORDER as readonly string[]).includes(state) && (counts[state] ?? 0) > 0)
    .sort()
  const states = [...known, ...unknown]

  if (states.length === 0) {
    return <p className={cn('text-caption text-muted-foreground', className)}>{emptyMessage}</p>
  }

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {states.map((state) => {
        const display = lifecycleDisplay(state)
        return (
          <span
            key={state}
            title={display.description}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-4xl px-2 py-0.5 text-xs font-medium',
              lifecycleToneClass(state),
            )}
          >
            {display.label}
            <span className="tabular-nums font-semibold">{counts[state]}</span>
          </span>
        )
      })}
    </div>
  )
}

export function LifecycleBadge({ state, className }: { state: string; className?: string }) {
  const display = lifecycleDisplay(state)
  return (
    <span
      title={display.description}
      className={cn(
        'inline-flex w-fit items-center rounded-4xl px-2 py-0.5 text-xs font-medium',
        lifecycleToneClass(state),
        className,
      )}
    >
      {display.label}
    </span>
  )
}
