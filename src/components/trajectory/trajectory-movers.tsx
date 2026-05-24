'use client'

import { cn } from '@/lib/utils'
import type { TrajectorySeries, TrajectorySummary } from '@/lib/trajectory/types'

/**
 * Horizontal strip of "biggest movers" cards beneath the hero chart.
 * Each card: dimension name, current scaled, delta number, mini sparkline.
 * Click a card → drill into that dimension.
 */
export function TrajectoryMoversStrip({
  summary,
  seriesById,
  onSelect,
}: {
  summary: TrajectorySummary
  /** Map of entityId → series so we can render a sparkline from points. */
  seriesById: Map<string, TrajectorySeries>
  onSelect: (entityId: string) => void
}) {
  // Drop movers whose series isn't in the current view — without this a
  // mover could be rendered for a dimension that isn't present in
  // seriesById (e.g. mid-refetch state), and clicking it would no-op.
  const movers = summary.topMovers
    .filter((m) => seriesById.has(m.entityId))
    .slice(0, 6)
  if (movers.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between px-1">
        <p className="text-overline text-[var(--gold)]">Biggest movers</p>
        <p className="text-caption text-muted-foreground">
          Click a card to drill into that dimension
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {movers.map((m) => {
          const series = seriesById.get(m.entityId)
          const positive = (m.deltaScaled ?? 0) >= 0
          return (
            <button
              key={m.entityId}
              type="button"
              onClick={() => onSelect(m.entityId)}
              className={cn(
                'group/card text-left rounded-xl border border-border bg-card p-3',
                'transition-all duration-200 hover:border-foreground/20 hover:shadow-md',
                'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p
                  className="text-sm font-semibold leading-tight line-clamp-2 min-h-[2.5rem]"
                  title={m.entityName}
                >
                  {m.entityName}
                </p>
                <DeltaBadge value={m.deltaScaled} />
              </div>

              <div className="mt-3 flex items-end justify-between gap-3">
                <div>
                  <p className="text-2xl font-bold tabular-nums leading-none">
                    {m.latestScaled !== null ? Math.round(m.latestScaled) : '—'}
                  </p>
                  <p className="text-caption text-muted-foreground mt-1">
                    Latest scaled
                  </p>
                </div>
                {series && (
                  <Sparkline
                    points={series.points.map((p) => p.scaledScore)}
                    positive={positive}
                  />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground tabular-nums">
        —
      </span>
    )
  }
  const r = Math.round(value * 10) / 10
  const positive = r >= 0
  const label = `${positive ? '+' : ''}${Number.isInteger(r) ? r : r.toFixed(1)}`
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums whitespace-nowrap',
        positive
          ? 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300'
          : 'bg-rose-500/10 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300',
      )}
    >
      {label}
    </span>
  )
}

function Sparkline({
  points,
  positive,
}: {
  points: (number | null)[]
  positive: boolean
}) {
  const W = 80
  const H = 32
  const vals = points.filter((v): v is number => v !== null)
  if (vals.length < 2) {
    return <div className="h-8 w-20" aria-hidden />
  }
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const coords: string[] = []
  let idx = 0
  for (const v of points) {
    if (v === null) {
      idx++
      continue
    }
    const x = points.length === 1 ? W / 2 : (idx / (points.length - 1)) * W
    const y = H - ((v - min) / span) * H
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    idx++
  }
  const colour = positive
    ? 'stroke-emerald-600 dark:stroke-emerald-400'
    : 'stroke-rose-500 dark:stroke-rose-400'
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="h-8 w-20"
      aria-hidden
    >
      <polyline
        points={coords.join(' ')}
        fill="none"
        className={colour}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
