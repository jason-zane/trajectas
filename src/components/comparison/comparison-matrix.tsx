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
import { ComparisonCell } from './comparison-cell'

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

export function ComparisonMatrix({
  data,
  visibleLevels = [...ALL_LEVELS],
  getCellStyle,
  onChangeRowSession,
}: {
  data: ComparisonResult
  visibleLevels?: ColumnLevel[]
  getCellStyle: (score: number | null) => CSSProperties
  onChangeRowSession: (entryId: string) => void
}) {
  const filtered = useMemo(
    () => filterByLevels(data.columns, visibleLevels),
    [data.columns, visibleLevels],
  )

  // Default sort: first visible rollup column descending. Resets when the
  // visible-levels selection or the column set changes.
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
  }, [data, sort])

  const onClickHeader = (columnId: string) => {
    setSort((prev) => {
      if (!prev || prev.columnId !== columnId) return { columnId, dir: 'desc' }
      if (prev.dir === 'desc') return { columnId, dir: 'asc' }
      return { columnId, dir: 'desc' }
    })
  }

  const sortIcon = (columnId: string) => {
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
              rowSpan={2}
              className="px-3 py-2 font-semibold text-xs text-left bg-muted border-b border-r border-border"
            >
              Participant
            </th>
            <th
              rowSpan={2}
              className="px-3 py-2 font-semibold text-xs text-left bg-muted border-b border-r border-border"
            >
              Date
            </th>
            <th
              rowSpan={2}
              className="px-3 py-2 font-semibold text-xs text-center bg-muted border-b border-r border-border"
            >
              #
            </th>
            {filtered.map(({ group, totalColumns }, idx) => (
              <th
                key={`${group.assessmentId}-${idx}`}
                colSpan={totalColumns}
                className="px-2 py-1 text-[9px] tracking-widest text-center uppercase bg-black/5 border-b border-r border-border"
              >
                {group.assessmentName}
              </th>
            ))}
          </tr>
          <tr>
            {filtered.flatMap(({ group, showRollup, childrenShown }, gIdx) => {
              const cells: React.ReactNode[] = []
              if (showRollup) {
                const sorted = sort?.columnId === group.rollup.id
                cells.push(
                  <th
                    key={`rollup-${group.rollup.id}-${gIdx}`}
                    className={cn(
                      'align-bottom border-b border-r border-border bg-muted px-1.5 py-1.5',
                      sorted && 'bg-primary/10',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onClickHeader(group.rollup.id)}
                      className="block w-full text-center text-[10px] font-bold uppercase tracking-wider leading-tight whitespace-normal break-words cursor-pointer hover:text-primary"
                    >
                      {group.rollup.name}
                      {sortIcon(group.rollup.id)}
                    </button>
                  </th>,
                )
              }
              for (const c of childrenShown) {
                const sorted = sort?.columnId === c.id
                cells.push(
                  <th
                    key={`child-${c.id}`}
                    className={cn(
                      'align-bottom border-b border-r border-border bg-muted px-1.5 py-1.5',
                      sorted && 'bg-primary/10',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onClickHeader(c.id)}
                      className="block w-full text-center text-[10px] font-medium leading-tight whitespace-normal break-words cursor-pointer hover:text-primary"
                    >
                      {c.name}
                      {sortIcon(c.id)}
                    </button>
                  </th>,
                )
              }
              return cells
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <Row
              key={row.entryId}
              row={row}
              filtered={filtered}
              getCellStyle={getCellStyle}
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
  filtered,
  getCellStyle,
  onChangeRowSession,
}: {
  row: ComparisonRow
  filtered: FilteredGroup[]
  getCellStyle: (score: number | null) => CSSProperties
  onChangeRowSession: (entryId: string) => void
}) {
  const repr = [...row.perAssessment].sort((a, b) =>
    (b.sessionStartedAt ?? '').localeCompare(a.sessionStartedAt ?? ''),
  )[0]
  const isInProgress = repr?.sessionStatus && repr.sessionStatus !== 'completed'

  return (
    <tr>
      <td
        data-testid="row-name"
        className="font-semibold text-xs px-2 py-1.5 border-b border-r border-border w-[1%] whitespace-nowrap"
      >
        {row.participantName}
      </td>
      <td className="text-[11px] opacity-75 px-1.5 py-1.5 border-b border-r border-border w-[1%] whitespace-nowrap">
        <button
          type="button"
          onClick={() => onChangeRowSession(row.entryId)}
          className="text-left hover:underline"
        >
          {repr?.sessionStartedAt
            ? new Date(repr.sessionStartedAt).toLocaleDateString()
            : '—'}
        </button>
        {isInProgress && (
          <span className="ml-1 text-[9px] uppercase tracking-wider opacity-70">in progress</span>
        )}
      </td>
      <td className="text-[10px] opacity-60 px-1 py-1.5 border-b border-r border-border text-center w-[1%]">
        {repr?.attemptNumber ?? '—'}
      </td>
      {filtered.flatMap(({ group, showRollup, childrenShown }, gIdx) => {
        const a = row.perAssessment.find((x) => x.assessmentId === group.assessmentId)
        const cells: React.ReactNode[] = []
        if (showRollup) {
          cells.push(
            <ComparisonCell
              key={`${row.entryId}-rollup-${group.rollup.id}-${gIdx}`}
              value={a?.cells[group.rollup.id] ?? null}
              style={getCellStyle(a?.cells[group.rollup.id] ?? null)}
              isRollup
            />,
          )
        }
        for (const c of childrenShown) {
          cells.push(
            <ComparisonCell
              key={`${row.entryId}-child-${c.id}`}
              value={a?.cells[c.id] ?? null}
              style={getCellStyle(a?.cells[c.id] ?? null)}
            />,
          )
        }
        return cells
      })}
    </tr>
  )
}
