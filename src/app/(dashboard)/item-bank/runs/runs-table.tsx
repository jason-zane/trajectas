'use client'

/**
 * Generation run list. Self-declared row type; nothing here is key material.
 */

import type { ColumnDef } from '@tanstack/react-table'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { formatDateTime } from '@/lib/formatting'

export type RunRow = {
  id: string
  generator: string
  kind: string
  seed: string
  status: string
  itemsProposed: number
  itemsAccepted: number
  itemsRejected: number
  ingestedItemCount: number
  requestedByName: string | null
  startedAt: string
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  completed: 'outline',
  succeeded: 'outline',
  running: 'default',
  failed: 'destructive',
}

const columns: ColumnDef<RunRow>[] = [
  {
    accessorKey: 'generator',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Generator" />,
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-semibold">{row.original.generator}</p>
        <p className="text-caption truncate font-mono text-muted-foreground">
          seed {row.original.seed}
        </p>
      </div>
    ),
  },
  {
    accessorKey: 'kind',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Kind" />,
    cell: ({ row }) => <Badge variant="secondary">{row.original.kind}</Badge>,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: 'acceptance',
    enableSorting: false,
    header: 'Proposed / accepted / rejected',
    cell: ({ row }) => (
      <span className="tabular-nums text-sm">
        {row.original.itemsProposed}
        <span className="text-muted-foreground"> / </span>
        <span className="text-[var(--emerald-dark)]">{row.original.itemsAccepted}</span>
        <span className="text-muted-foreground"> / </span>
        <span className="text-destructive">{row.original.itemsRejected}</span>
      </span>
    ),
  },
  {
    accessorKey: 'ingestedItemCount',
    header: ({ column }) => <DataTableColumnHeader column={column} title="In bank" />,
    cell: ({ row }) => (
      <span className="tabular-nums text-sm text-muted-foreground">
        {row.original.ingestedItemCount}
      </span>
    ),
  },
  {
    accessorKey: 'startedAt',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Started" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">{formatDateTime(row.original.startedAt)}</span>
    ),
  },
]

export function RunsTable({ runs }: { runs: RunRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={runs}
      searchableColumns={['generator', 'seed', 'kind']}
      searchPlaceholder="Search runs by generator or seed"
      defaultSort={{ id: 'startedAt', desc: true }}
      rowHref={(row) => `/item-bank/runs/${row.id}`}
      getRowId={(row) => row.id}
      pageSize={25}
      emptyState={
        <EmptyState
          variant="item"
          size="sm"
          title="No runs match"
          description="Adjust the search to see more runs."
        />
      }
    />
  )
}
