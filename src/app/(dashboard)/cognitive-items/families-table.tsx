'use client'

/**
 * Family list for the bank overview (#347 scope item 4).
 *
 * `FamilyRow` is declared here rather than imported from the DAL: client
 * components on this surface own their own props type so that what reaches the
 * browser is a deliberate list of fields rather than whatever a server DTO
 * happens to carry. Nothing in this table is key material.
 */

import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { DifficultyPriorValue } from './difficulty-prior'
import { LifecycleBreakdown } from './bank-stats'

export type FamilyRow = {
  id: string
  code: string
  kind: string
  constructName: string | null
  ruleIds: string[]
  radicalCount: number
  difficultyPriorB: number | null
  difficultyPriorBand: string | null
  itemCount: number
  lifecycleCounts: Record<string, number>
  difficultyPriorBandCounts: Record<string, number>
  totalExposureCount: number
}

const columns: ColumnDef<FamilyRow>[] = [
  {
    accessorKey: 'code',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Family" />,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-semibold">{row.original.code}</p>
        <p className="text-caption truncate text-muted-foreground">
          {row.original.constructName ?? row.original.kind}
        </p>
      </div>
    ),
  },
  {
    id: 'rules',
    accessorFn: (row) => row.ruleIds,
    enableSorting: false,
    header: 'Rules',
    cell: ({ row }) => {
      const { ruleIds, radicalCount } = row.original
      if (ruleIds.length === 0) {
        return <span className="text-caption text-muted-foreground">No rules recorded</span>
      }
      return (
        <div className="flex flex-wrap items-center gap-1">
          {ruleIds.map((rule) => (
            <Badge key={rule} variant="secondary" className="font-mono text-[0.6875rem]">
              {rule}
            </Badge>
          ))}
          {radicalCount > 0 ? (
            <span className="text-caption text-muted-foreground">
              {radicalCount} radical{radicalCount === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      )
    },
  },
  {
    // Sorts on the prior logit; the cell carries its own "prior" marker so the
    // number can never be read as a measurement.
    accessorKey: 'difficultyPriorB',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Difficulty prior" />,
    cell: ({ row }) => (
      <DifficultyPriorValue
        value={row.original.difficultyPriorB}
        band={row.original.difficultyPriorBand}
      />
    ),
  },
  {
    accessorKey: 'itemCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
    cell: ({ row }) => <span className="tabular-nums text-sm">{row.original.itemCount}</span>,
  },
  {
    id: 'lifecycle',
    enableSorting: false,
    header: 'Lifecycle',
    cell: ({ row }) => (
      <LifecycleBreakdown counts={row.original.lifecycleCounts} emptyMessage="—" />
    ),
  },
  {
    accessorKey: 'totalExposureCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Exposures" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.totalExposureCount.toLocaleString('en-AU')}
      </span>
    ),
  },
]

export function FamiliesTable({ families }: { families: FamilyRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={families}
      searchableColumns={['code', 'constructName']}
      searchPlaceholder="Search families"
      defaultSort={{ id: 'code', desc: false }}
      rowHref={(row) => `/cognitive-items/families/${row.id}`}
      getRowId={(row) => row.id}
      pageSize={25}
      emptyState={
        <EmptyState
          variant="item"
          size="sm"
          title="No families match"
          description="Adjust the search to see more of the bank."
        />
      }
    />
  )
}
