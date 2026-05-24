'use client'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALL_LEVELS } from '@/lib/comparison/types'
import type {
  ColumnGroup,
  ColumnLevel,
  ComparisonResult,
  ComparisonRow,
} from '@/lib/comparison/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ScoreCell } from '@/components/results/score-cell'
import { getInitials, representativeSession } from '@/lib/comparison/display'

type SortKey = { columnId: string; dir: 'asc' | 'desc' } | null

type FilteredGroup = {
  group: ColumnGroup
  showRollup: boolean
  childrenShown: ColumnGroup['children']
  totalColumns: number
}

function filterByLevels(
  columns: ColumnGroup[],
  visibleLevels: ColumnLevel[],
): FilteredGroup[] {
  const wantsDimension = visibleLevels.includes('dimension')
  return columns
    .map((group) => {
      const showRollup = wantsDimension && group.rollup.level === 'dimension'
      const childrenShown = group.children.filter((c) => visibleLevels.includes(c.level))
      const totalColumns = (showRollup ? 1 : 0) + childrenShown.length
      return { group, showRollup, childrenShown, totalColumns }
    })
    .filter((g) => g.totalColumns > 0)
}

function computeColumnMeans(
  rows: ComparisonRow[],
  filtered: FilteredGroup[],
): Map<string, number> {
  const sums = new Map<string, { total: number; count: number }>()
  const bump = (id: string, v: number | null | undefined) => {
    if (v === null || v === undefined) return
    const cur = sums.get(id) ?? { total: 0, count: 0 }
    cur.total += v
    cur.count += 1
    sums.set(id, cur)
  }
  for (const row of rows) {
    for (const { group, showRollup, childrenShown } of filtered) {
      const a = row.perAssessment.find((x) => x.assessmentId === group.assessmentId)
      if (!a) continue
      if (showRollup) bump(group.rollup.id, a.cells[group.rollup.id])
      for (const c of childrenShown) bump(c.id, a.cells[c.id])
    }
  }
  const out = new Map<string, number>()
  for (const [id, { total, count }] of sums) {
    if (count > 0) out.set(id, total / count)
  }
  return out
}

export function ComparisonMatrix({
  data,
  visibleLevels = [...ALL_LEVELS],
  getCellStyle,
  deltaMode = false,
  longitudinal = false,
  onChangeRowSession,
}: {
  data: ComparisonResult
  visibleLevels?: ColumnLevel[]
  getCellStyle: (score: number | null) => CSSProperties
  deltaMode?: boolean
  longitudinal?: boolean
  onChangeRowSession: (entryId: string) => void
}) {
  const filtered = useMemo(
    () => filterByLevels(data.columns, visibleLevels),
    [data.columns, visibleLevels],
  )

  const groupMeans = useMemo(
    () => computeColumnMeans(data.rows, filtered),
    [data.rows, filtered],
  )

  const defaultSortColumnId = useMemo(() => {
    const firstWithRollup = filtered.find((g) => g.showRollup)
    if (firstWithRollup) return firstWithRollup.group.rollup.id
    const firstWithChild = filtered.find((g) => g.childrenShown.length > 0)
    return firstWithChild?.childrenShown[0]?.id ?? null
  }, [filtered])

  const [sort, setSort] = useState<SortKey>(
    defaultSortColumnId ? { columnId: defaultSortColumnId, dir: 'desc' } : null,
  )
  useEffect(() => {
    if (sort && filtered.every(
      (g) =>
        g.group.rollup.id !== sort.columnId &&
        !g.childrenShown.some((c) => c.id === sort.columnId),
    )) {
      setSort(defaultSortColumnId ? { columnId: defaultSortColumnId, dir: 'desc' } : null)
    }
  }, [filtered, sort, defaultSortColumnId])

  const sortedRows = useMemo(() => {
    // In longitudinal mode we always sort by session date ascending so
    // chronological reading is preserved regardless of column sort clicks.
    if (longitudinal) {
      return [...data.rows].sort((a, b) => {
        const ad = representativeSession(a)?.sessionStartedAt ?? ''
        const bd = representativeSession(b)?.sessionStartedAt ?? ''
        return ad.localeCompare(bd)
      })
    }
    if (!sort) return data.rows
    const dirMul = sort.dir === 'asc' ? 1 : -1
    const groupId = data.columns.find(
      (g) => g.rollup.id === sort.columnId || g.children.some((c) => c.id === sort.columnId),
    )?.assessmentId
    return [...data.rows].sort((a, b) => {
      const ra = a.perAssessment.find((x) => x.assessmentId === groupId)
      const rb = b.perAssessment.find((x) => x.assessmentId === groupId)
      const va = ra?.cells[sort.columnId] ?? null
      const vb = rb?.cells[sort.columnId] ?? null
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return (va - vb) * dirMul
    })
  }, [data, sort, longitudinal])

  const onClickHeader = (columnId: string) => {
    if (longitudinal) return
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: 'desc' }
      if (prev.dir === 'desc') return { columnId, dir: 'asc' }
      return { columnId, dir: 'desc' }
    })
  }

  const sortIcon = (columnId: string) => {
    if (longitudinal) return null
    if (sort?.columnId !== columnId) return null
    return sort.dir === 'desc' ? (
      <ChevronDown className="ml-1 inline-block size-3" />
    ) : (
      <ChevronUp className="ml-1 inline-block size-3" />
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-background shadow-sm">
      <table className="text-[11px] border-separate border-spacing-0 w-full">
        <thead>
          <tr>
            <th
              rowSpan={2}
              className="sticky left-0 z-20 px-3 py-2 text-overline text-left bg-muted/60 border-b border-r border-border w-[260px]"
            >
              {longitudinal ? 'Session' : 'Participant'}
            </th>
            {filtered.map(({ group, totalColumns }, idx) => (
              <th
                key={`${group.assessmentId}-${idx}`}
                colSpan={totalColumns}
                className={cn(
                  'px-2 py-1.5 text-[10px] tracking-widest text-center uppercase bg-muted/40 border-b border-r border-border font-semibold',
                  idx === 0 && 'border-l border-l-border',
                )}
              >
                {group.assessmentName}
              </th>
            ))}
          </tr>
          <tr>
            {filtered.flatMap(({ group, showRollup, childrenShown }, gIdx) => {
              const cells: React.ReactNode[] = []
              const isFirstGroupCol = (subIdx: number) => gIdx > 0 && subIdx === 0
              if (showRollup) {
                const sorted = sort?.columnId === group.rollup.id && !longitudinal
                cells.push(
                  <th
                    key={`rollup-${group.rollup.id}-${gIdx}`}
                    className={cn(
                      'align-bottom border-b border-r border-border bg-muted/30 px-1.5 py-1.5',
                      sorted && 'bg-primary/10',
                      isFirstGroupCol(0) && 'border-l border-l-border',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onClickHeader(group.rollup.id)}
                      className={cn(
                        'block w-full text-center text-[10px] font-bold uppercase tracking-wider leading-tight whitespace-normal break-words',
                        !longitudinal && 'cursor-pointer hover:text-primary',
                      )}
                    >
                      {group.rollup.name}
                      {sortIcon(group.rollup.id)}
                    </button>
                  </th>,
                )
              }
              childrenShown.forEach((c, cIdx) => {
                const sorted = sort?.columnId === c.id && !longitudinal
                const isFirst = isFirstGroupCol(showRollup ? cIdx + 1 : cIdx)
                cells.push(
                  <th
                    key={`child-${c.id}`}
                    className={cn(
                      'align-bottom border-b border-r border-border bg-muted/30 px-1.5 py-1.5',
                      sorted && 'bg-primary/10',
                      isFirst && 'border-l border-l-border',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onClickHeader(c.id)}
                      className={cn(
                        'block w-full text-center text-[10px] font-medium leading-tight whitespace-normal break-words',
                        !longitudinal && 'cursor-pointer hover:text-primary',
                      )}
                    >
                      {c.name}
                      {sortIcon(c.id)}
                    </button>
                  </th>,
                )
              })
              return cells
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => (
            <Row
              key={row.entryId}
              row={row}
              rowIndex={idx}
              filtered={filtered}
              getCellStyle={getCellStyle}
              groupMeans={groupMeans}
              deltaMode={deltaMode}
              longitudinal={longitudinal}
              onChangeRowSession={onChangeRowSession}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Row({
  row,
  rowIndex,
  filtered,
  getCellStyle,
  groupMeans,
  deltaMode,
  longitudinal,
  onChangeRowSession,
}: {
  row: ComparisonRow
  rowIndex: number
  filtered: FilteredGroup[]
  getCellStyle: (score: number | null) => CSSProperties
  groupMeans: Map<string, number>
  deltaMode: boolean
  longitudinal: boolean
  onChangeRowSession: (entryId: string) => void
}) {
  const repr = representativeSession(row)
  const isInProgress = repr?.sessionStatus && repr.sessionStatus !== 'completed'
  const dateLabel = repr?.sessionStartedAt
    ? new Date(repr.sessionStartedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—'
  const zebra = rowIndex % 2 === 1

  return (
    <tr className={cn('group/row', zebra && 'bg-muted/20')}>
      <td
        className={cn(
          'sticky left-0 z-10 px-3 py-2 border-b border-r border-border w-[260px] align-middle',
          zebra ? 'bg-muted/40' : 'bg-background',
          'group-hover/row:bg-muted/60 transition-colors',
        )}
      >
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" className="size-7">
            <AvatarFallback className="text-[10px] font-semibold">
              {getInitials(row.participantName, row.participantEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col leading-tight">
            <span
              data-testid="row-name"
              className="truncate text-xs font-semibold"
            >
              {longitudinal && dateLabel !== '—' ? dateLabel : row.participantName}
            </span>
            <button
              type="button"
              onClick={() => onChangeRowSession(row.entryId)}
              className="text-left text-[10.5px] text-muted-foreground hover:text-foreground hover:underline"
              title="Change which session is shown"
            >
              {longitudinal
                ? row.participantName
                : (
                  <>
                    {dateLabel}
                    {repr?.attemptNumber ? ` · Attempt ${repr.attemptNumber}` : ''}
                  </>
                )}
              {isInProgress && (
                <span className="ml-1 rounded bg-amber-500/10 px-1 py-px text-[9px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-300">
                  in progress
                </span>
              )}
            </button>
          </div>
        </div>
      </td>
      {filtered.flatMap(({ group, showRollup, childrenShown }, gIdx) => {
        const a = row.perAssessment.find((x) => x.assessmentId === group.assessmentId)
        const cells: React.ReactNode[] = []
        if (showRollup) {
          const v = a?.cells[group.rollup.id] ?? null
          cells.push(
            <ScoreCell
              key={`${row.entryId}-rollup-${group.rollup.id}-${gIdx}`}
              value={v}
              style={getCellStyle(v)}
              isRollup
              showBar
              mode={deltaMode ? 'delta' : 'value'}
              groupMean={groupMeans.get(group.rollup.id) ?? null}
            />,
          )
        }
        for (const c of childrenShown) {
          const v = a?.cells[c.id] ?? null
          cells.push(
            <ScoreCell
              key={`${row.entryId}-child-${c.id}`}
              value={v}
              style={getCellStyle(v)}
              showBar
              mode={deltaMode ? 'delta' : 'value'}
              groupMean={groupMeans.get(c.id) ?? null}
            />,
          )
        }
        return cells
      })}
    </tr>
  )
}
