'use client'
import { useMemo, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import type { ComparisonResult, ComparisonRow } from '@/lib/comparison/types'
import { ComparisonCell } from './comparison-cell'

type SortKey = { columnId: string; dir: 'asc' | 'desc' } | null

export function ComparisonMatrix({
  data,
  getCellStyle,
  onChangeRowSession,
}: {
  data: ComparisonResult
  getCellStyle: (score: number | null) => CSSProperties
  onChangeRowSession: (entryId: string) => void
}) {
  const [sort, setSort] = useState<SortKey>(null)

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
      return null
    })
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
            {data.columns.map((g, idx) => (
              <th
                key={`${g.assessmentId}-${idx}`}
                colSpan={1 + g.children.length}
                className="px-2 py-1 text-[9px] tracking-widest text-center uppercase bg-black/5 border-b border-r border-border"
              >
                {g.assessmentName}
              </th>
            ))}
          </tr>
          <tr>
            {data.columns.flatMap((g, gIdx) => [
              <th
                key={`rollup-${g.rollup.id}-${gIdx}`}
                className={cn(
                  'h-28 align-bottom border-b border-r border-border bg-muted',
                  'min-w-[36px] max-w-[36px] p-0',
                )}
              >
                <button
                  type="button"
                  onClick={() => onClickHeader(g.rollup.id)}
                  className="origin-bottom-left -rotate-[55deg] translate-x-2 whitespace-nowrap pb-1.5 pl-1.5 text-[10px] font-bold uppercase tracking-wider"
                >
                  {g.rollup.name}
                </button>
              </th>,
              ...g.children.map((c) => (
                <th
                  key={`child-${c.id}`}
                  className="h-28 align-bottom border-b border-r border-border bg-muted min-w-[36px] max-w-[36px] p-0"
                >
                  <button
                    type="button"
                    onClick={() => onClickHeader(c.id)}
                    className="origin-bottom-left -rotate-[55deg] translate-x-2 whitespace-nowrap pb-1.5 pl-1.5 text-[10px] font-medium"
                  >
                    {c.name}
                  </button>
                </th>
              )),
            ])}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <Row
              key={row.entryId}
              row={row}
              columns={data.columns}
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
  columns,
  getCellStyle,
  onChangeRowSession,
}: {
  row: ComparisonRow
  columns: ComparisonResult['columns']
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
        className="font-semibold text-xs px-2.5 py-1.5 border-b border-r border-border min-w-[140px]"
      >
        {row.participantName}
      </td>
      <td className="text-[11px] opacity-75 px-2 py-1.5 border-b border-r border-border min-w-[80px]">
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
      <td className="text-[10px] opacity-60 px-2 py-1.5 border-b border-r border-border text-center min-w-[30px]">
        {repr?.attemptNumber ?? '—'}
      </td>
      {columns.flatMap((g, gIdx) => {
        const a = row.perAssessment.find((x) => x.assessmentId === g.assessmentId)!
        return [
          <ComparisonCell
            key={`${row.entryId}-rollup-${g.rollup.id}-${gIdx}`}
            value={a.cells[g.rollup.id] ?? null}
            style={getCellStyle(a.cells[g.rollup.id] ?? null)}
            isRollup
          />,
          ...g.children.map((c) => (
            <ComparisonCell
              key={`${row.entryId}-child-${c.id}`}
              value={a.cells[c.id] ?? null}
              style={getCellStyle(a.cells[c.id] ?? null)}
            />
          )),
        ]
      })}
    </tr>
  )
}
