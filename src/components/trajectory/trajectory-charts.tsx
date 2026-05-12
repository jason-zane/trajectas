'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { TrajectoryChart } from './trajectory-chart'
import type { TrajectorySeries } from '@/lib/trajectory/types'

type SortKey = 'name' | 'biggest-change' | 'most-recent' | 'most-stable'

function firstToLastDelta(s: TrajectorySeries): number {
  const last = s.deltas[s.deltas.length - 1]
  return last?.deltaScaled ?? 0
}

function mostRecentDeltaTime(s: TrajectorySeries): number {
  const last = s.points[s.points.length - 1]?.completedAt
  return last ? Date.parse(last) : 0
}

export function TrajectoryChartGrid({
  series,
  onSelect,
}: {
  series: TrajectorySeries[]
  onSelect?: (entityId: string) => void
}) {
  const [sort, setSort] = useState<SortKey>('name')

  const sorted = useMemo(() => {
    const arr = [...series]
    switch (sort) {
      case 'biggest-change':
        arr.sort((a, b) => Math.abs(firstToLastDelta(b)) - Math.abs(firstToLastDelta(a)))
        break
      case 'most-recent':
        arr.sort((a, b) => mostRecentDeltaTime(b) - mostRecentDeltaTime(a))
        break
      case 'most-stable':
        arr.sort((a, b) => Math.abs(firstToLastDelta(a)) - Math.abs(firstToLastDelta(b)))
        break
      default:
        arr.sort((a, b) => a.entityName.localeCompare(b.entityName))
    }
    return arr
  }, [series, sort])

  if (sorted.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No entities to show at this level for the selected assessments.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sort</span>
        <SortChip
          active={sort === 'name'}
          onClick={() => setSort('name')}
          label="A → Z"
        />
        <SortChip
          active={sort === 'biggest-change'}
          onClick={() => setSort('biggest-change')}
          label="Biggest change"
        />
        <SortChip
          active={sort === 'most-recent'}
          onClick={() => setSort('most-recent')}
          label="Most recent"
        />
        <SortChip
          active={sort === 'most-stable'}
          onClick={() => setSort('most-stable')}
          label="Most stable"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map((s) => (
          <button
            key={s.entityId}
            type="button"
            onClick={() => onSelect?.(s.entityId)}
            className="text-left hover:scale-[1.01] transition-transform"
            aria-label={`Open ${s.entityName} detail`}
          >
            <div className="px-1 mb-1.5 flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold truncate" title={s.entityName}>
                {s.entityName}
              </h4>
              {s.parentName && (
                <span
                  className="text-[10px] uppercase tracking-wider text-muted-foreground truncate"
                  title={s.parentName}
                >
                  {s.parentName}
                </span>
              )}
            </div>
            <TrajectoryChart series={s} />
            <DeltaSummary series={s} />
          </button>
        ))}
      </div>
    </div>
  )
}

function SortChip({
  active,
  onClick,
  label,
}: {
  active: boolean
  onClick: () => void
  label: string
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      className="h-6 px-2 text-[11px]"
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function DeltaSummary({ series }: { series: TrajectorySeries }) {
  const last = series.deltas[series.deltas.length - 1]
  if (!last) {
    return (
      <p className="px-1 mt-1.5 text-[10px] text-muted-foreground">
        {series.points.length === 1 ? 'Single snapshot' : 'No deltas'}
      </p>
    )
  }
  const d = last.deltaScaled
  const arrow = d === null ? '·' : d > 0 ? '↑' : d < 0 ? '↓' : '·'
  const colour = d === null
    ? 'text-muted-foreground'
    : d > 0
      ? 'text-emerald-600 dark:text-emerald-400'
      : d < 0
        ? 'text-rose-600 dark:text-rose-400'
        : 'text-muted-foreground'
  return (
    <p className="px-1 mt-1.5 text-[10px] flex items-baseline gap-1.5">
      <span className={colour}>
        {arrow} {d === null ? '—' : `${d > 0 ? '+' : ''}${d}`}
      </span>
      <span className="text-muted-foreground">
        over {series.points.length} {series.points.length === 1 ? 'session' : 'sessions'}
        {' · '}
        {last.daysBetween} {last.daysBetween === 1 ? 'day' : 'days'}
      </span>
    </p>
  )
}
