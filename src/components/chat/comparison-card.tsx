'use client'

// =============================================================================
// ComparisonCard — people side by side on one instrument.
//
// Built on the shared DataTable per docs/ui-standards.md, so it inherits the
// platform's zebra, hover, typography and accessibility rather than
// re-deriving them. With no searchable or filterable columns the toolbar does
// not render, and pagination is suppressed, so it sits inside a chat card
// without the page-level furniture.
//
// Shows the band each score falls in rather than a rank position. A band is a
// criterion claim ("met this much of the standard"); a rank implies a
// population, and there isn't one until norms exist. The leader marker says who
// met more of the standard ON THIS INSTRUMENT — and is withheld where either
// score is provisional, because an unsettled score cannot settle a comparison.
// =============================================================================

import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { DataTable } from '@/components/data-table/data-table'
import { formatDateOrNull } from '@/lib/formatting'
import { resolveBand } from '@/lib/reports/band-resolution'
import { getBandChipColours } from '@/lib/reports/band-scheme'
import type { BandScheme, PaletteKey } from '@/lib/reports/band-scheme'
import { DestinationLinks } from './destination-links'
import type { ComparisonBlock, ComparisonCell } from '@/lib/chat/envelope'

interface Row {
  factorId: string
  factor: string
  cells: Record<string, ComparisonCell | undefined>
}

export function ComparisonCard({ block }: { block: ComparisonBlock }) {
  const scheme: BandScheme = useMemo(
    () => ({
      palette: block.bandScheme.palette as PaletteKey,
      bands: block.bandScheme.bands.map((b) => ({ ...b, indicatorTier: 'mid' as const })),
    }),
    [block.bandScheme],
  )

  const rows: Row[] = useMemo(
    () =>
      block.factors.map((factor) => ({
        factorId: factor.factorId,
        factor: factor.name,
        cells: Object.fromEntries(
          block.people.map((person) => [person.name, person.cells[factor.factorId]]),
        ),
      })),
    [block.factors, block.people],
  )

  const columns: ColumnDef<Row, unknown>[] = useMemo(() => {
    const leaderByFactor = new Map<string, number | null>()
    for (const factor of block.factors) {
      let best: number | null = null
      let settled = true
      for (const person of block.people) {
        const cell = person.cells[factor.factorId]
        if (!cell) continue
        if (cell.provisional) settled = false
        if (best === null || cell.score > best) best = cell.score
      }
      // No leader marker at all when any contributing score is provisional.
      leaderByFactor.set(factor.factorId, settled ? best : null)
    }

    return [
      {
        accessorKey: 'factor',
        header: 'Factor',
        cell: ({ row }) => <span className="text-sm">{row.original.factor}</span>,
      },
      ...block.people.map<ColumnDef<Row, unknown>>((person) => ({
        id: person.name,
        header: () => (
          <span className="flex flex-col">
            <span className="truncate">{person.name}</span>
            <span className="truncate text-[10px] font-normal text-muted-foreground">
              {formatDateOrNull(person.completedAt) ?? '—'}
            </span>
          </span>
        ),
        cell: ({ row }) => {
          const cell = row.original.cells[person.name]
          if (!cell) return <span className="text-muted-foreground">—</span>
          const band = resolveBand(cell.score, scheme)
          const chip = getBandChipColours(scheme.palette, band.bandIndex, band.bandCount)
          const leads =
            block.people.length > 1 &&
            leaderByFactor.get(row.original.factorId) === cell.score
          return (
            <span className="flex items-center gap-1.5">
              <span
                className="rounded px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                style={{ background: chip.bg, color: chip.text }}
              >
                {cell.score}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {band.bandLabel}
                {cell.provisional ? ' · provisional' : ''}
              </span>
              {leads ? (
                <span className="text-[10px] font-medium text-primary" aria-label="leads">
                  ▲
                </span>
              ) : null}
            </span>
          )
        },
      })),
    ]
  }, [block.factors, block.people, scheme])

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background/60">
      <div className="border-b border-border px-3 py-2">
        <p className="text-sm font-semibold">{block.assessmentTitle ?? 'Comparison'}</p>
        <p className="text-xs text-muted-foreground">
          {block.people.length} people ·{' '}
          {block.sameCampaign ? 'same campaign' : 'different campaigns'}
        </p>
      </div>

      <div className="overflow-x-auto p-2">
        <DataTable columns={columns} data={rows} hideClientPagination />
      </div>

      {block.caveats.length > 0 && (
        <div className="flex gap-2 border-t border-border bg-muted/40 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-muted-foreground">
            {block.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      )}

      <DestinationLinks destinations={block.destinations} />
    </div>
  )
}
