'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScoreCell } from '@/components/results/score-cell'
import type { TrajectorySeries } from '@/lib/trajectory/types'

type Column = {
  sessionId: string
  completedAt: string
  assessmentName: string
  attemptNumber: number
}

type SortKey = { columnId: string | 'first-to-latest'; dir: 'asc' | 'desc' } | null

/**
 * Matrix view for trajectory: rows = entities at the selected level,
 * columns = sessions ordered by completedAt (oldest left). Trailing column
 * shows the first-to-latest delta. Cells reuse <ScoreCell> for consistency
 * with the Compare matrix.
 */
export function TrajectoryMatrix({ series }: { series: TrajectorySeries[] }) {
  // Union of all session ids across series, ordered globally by completedAt asc.
  const columns = useMemo<Column[]>(() => {
    const seen = new Map<string, Column>()
    for (const s of series) {
      for (const p of s.points) {
        if (!seen.has(p.sessionId)) {
          seen.set(p.sessionId, {
            sessionId: p.sessionId,
            completedAt: p.completedAt,
            assessmentName: p.assessmentName,
            attemptNumber: p.attemptNumber,
          })
        }
      }
    }
    return [...seen.values()].sort((a, b) =>
      a.completedAt.localeCompare(b.completedAt),
    )
  }, [series])

  const [sort, setSort] = useState<SortKey>(null)

  const sorted = useMemo(() => {
    if (!sort) return series
    const dir = sort.dir === 'asc' ? 1 : -1
    return [...series].sort((a, b) => {
      const va = scoreForColumn(a, sort.columnId)
      const vb = scoreForColumn(b, sort.columnId)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * dir
    })
  }, [series, sort])

  if (series.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No entities to show at this level for the selected assessments.
      </div>
    )
  }

  const onClickHeader = (columnId: string | 'first-to-latest') => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: 'desc' }
      if (prev.dir === 'desc') return { columnId, dir: 'asc' }
      return { columnId, dir: 'desc' }
    })
  }

  const sortIcon = (columnId: string | 'first-to-latest') => {
    if (sort?.columnId !== columnId) return null
    return sort.dir === 'desc' ? (
      <ChevronDown className="ml-1 inline-block size-3" />
    ) : (
      <ChevronUp className="ml-1 inline-block size-3" />
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="text-[11px] border-separate border-spacing-0 w-full">
        <thead>
          <tr>
            <th
              className="px-3 py-2 font-semibold text-xs text-left bg-muted border-b border-r border-border w-[1%] whitespace-nowrap sticky left-0"
            >
              Entity
            </th>
            {columns.map((c) => {
              const sorted = sort?.columnId === c.sessionId
              return (
                <th
                  key={c.sessionId}
                  className={cn(
                    'align-bottom border-b border-r border-border bg-muted px-2 py-1.5',
                    sorted && 'bg-primary/10',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onClickHeader(c.sessionId)}
                    className="block w-full text-center text-[10px] font-medium leading-tight whitespace-normal break-words cursor-pointer hover:text-primary"
                  >
                    <div className="font-semibold">
                      {new Date(c.completedAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: '2-digit',
                      })}
                    </div>
                    <div className="opacity-75 truncate" title={c.assessmentName}>
                      {c.assessmentName}
                    </div>
                    <div className="opacity-60">#{c.attemptNumber}</div>
                    {sortIcon(c.sessionId)}
                  </button>
                </th>
              )
            })}
            <th
              className={cn(
                'align-bottom border-b border-r border-border bg-muted px-2 py-1.5',
                sort?.columnId === 'first-to-latest' && 'bg-primary/10',
              )}
            >
              <button
                type="button"
                onClick={() => onClickHeader('first-to-latest')}
                className="block w-full text-center text-[10px] font-bold uppercase tracking-wider leading-tight whitespace-normal break-words cursor-pointer hover:text-primary"
              >
                Δ
                {sortIcon('first-to-latest')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s) => (
            <tr key={s.entityId}>
              <td className="font-semibold text-xs px-3 py-1.5 border-b border-r border-border whitespace-nowrap sticky left-0 bg-card">
                <div>{s.entityName}</div>
                {s.parentName && (
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">
                    {s.parentName}
                  </div>
                )}
              </td>
              {columns.map((c) => {
                const point = s.points.find((p) => p.sessionId === c.sessionId)
                return (
                  <ScoreCell
                    key={`${s.entityId}-${c.sessionId}`}
                    value={point?.scaledScore ?? null}
                  />
                )
              })}
              <DeltaCell series={s} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function scoreForColumn(s: { points: { sessionId: string; scaledScore: number | null }[]; deltas: { deltaScaled: number | null }[] }, columnId: string | 'first-to-latest'): number | null {
  if (columnId === 'first-to-latest') {
    return s.deltas[s.deltas.length - 1]?.deltaScaled ?? null
  }
  const point = s.points.find((p) => p.sessionId === columnId)
  return point?.scaledScore ?? null
}

function DeltaCell({ series }: { series: TrajectorySeries }) {
  const last = series.deltas[series.deltas.length - 1]
  const d = last?.deltaScaled ?? null
  return (
    <td className="text-center font-semibold text-[11px] px-2 py-1.5 border-b border-r border-border last:border-r-0">
      {d === null ? (
        <span className="opacity-60">—</span>
      ) : (
        <span
          className={
            d > 0
              ? 'text-emerald-600 dark:text-emerald-400'
              : d < 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-muted-foreground'
          }
        >
          {d > 0 ? '+' : ''}
          {d}
        </span>
      )}
    </td>
  )
}
