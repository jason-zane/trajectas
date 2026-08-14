'use client'

/**
 * The bank's item list, shared by the family detail, review queue and
 * generation run screens (#347 scope items 3, 4 and 5).
 *
 * `ItemRow` is a redacted, self-declared props type. It deliberately does NOT
 * mirror `BankItemSummary` — and it must never grow toward `ItemForReview`,
 * which carries the answer key and the per-distractor error labels. Key
 * material is rendered only by the server component on the review screen.
 */

import type { ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, Check, Minus } from 'lucide-react'
import { DataTable, DataTableColumnHeader } from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/empty-state'
import { cn } from '@/lib/utils'
import { DifficultyPriorValue } from './difficulty-prior'
import { LifecycleBadge } from './bank-stats'

/** The standing state of one sign-off, reduced to what a list cell can show. */
export type SignOffCell = {
  present: boolean
  approved: boolean
  matchesCurrentContent: boolean
  reviewer: string | null
} | null

export type ItemRow = {
  id: string
  stem: string
  familyId: string | null
  familyCode: string | null
  lifecycleState: string
  difficultyPriorB: number | null
  difficultyPriorBand: string | null
  exposureCount: number
  generatorSeed: string | null
  contentSignOff: SignOffCell
  fairnessSignOff: SignOffCell
  /** Assessment section titles this item is placed in. */
  formPlacements: string[]
}

function SignOffChip({ label, signOff }: { label: string; signOff: SignOffCell }) {
  if (!signOff || !signOff.present) {
    return (
      <span
        title={`No ${label.toLowerCase()} review recorded`}
        className="inline-flex items-center gap-1 rounded-4xl bg-muted px-1.5 py-0.5 text-[0.6875rem] font-medium text-muted-foreground"
      >
        <Minus className="size-3" />
        {label}
      </span>
    )
  }

  if (!signOff.approved) {
    return (
      <span
        title={`Standing ${label.toLowerCase()} review is a rejection${signOff.reviewer ? ` — ${signOff.reviewer}` : ''}`}
        className="inline-flex items-center gap-1 rounded-4xl bg-destructive/10 px-1.5 py-0.5 text-[0.6875rem] font-medium text-destructive"
      >
        <AlertTriangle className="size-3" />
        {label}
      </span>
    )
  }

  if (!signOff.matchesCurrentContent) {
    return (
      <span
        title={`${label} sign-off was given for different content — re-review required`}
        className="inline-flex items-center gap-1 rounded-4xl bg-[var(--gold)]/15 px-1.5 py-0.5 text-[0.6875rem] font-medium text-[var(--emerald-dark)]"
      >
        <AlertTriangle className="size-3" />
        {label} stale
      </span>
    )
  }

  return (
    <span
      title={`${label} approved${signOff.reviewer ? ` — ${signOff.reviewer}` : ''}`}
      className="inline-flex items-center gap-1 rounded-4xl bg-[var(--emerald)]/10 px-1.5 py-0.5 text-[0.6875rem] font-medium text-[var(--emerald-dark)]"
    >
      <Check className="size-3" />
      {label}
    </span>
  )
}

function buildColumns(showFamily: boolean): ColumnDef<ItemRow>[] {
  const columns: ColumnDef<ItemRow>[] = [
    {
      accessorKey: 'stem',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Item" />,
      cell: ({ row }) => (
        <div className="min-w-0 max-w-sm">
          <p className="truncate font-medium">{row.original.stem}</p>
          <p className="text-caption truncate font-mono text-muted-foreground">
            {row.original.generatorSeed ?? row.original.id}
          </p>
        </div>
      ),
    },
  ]

  if (showFamily) {
    columns.push({
      accessorKey: 'familyCode',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Family" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.familyCode ?? '—'}</span>
      ),
    })
  }

  columns.push(
    {
      accessorKey: 'lifecycleState',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Lifecycle" />,
      cell: ({ row }) => <LifecycleBadge state={row.original.lifecycleState} />,
    },
    {
      id: 'signOffs',
      enableSorting: false,
      header: 'Sign-offs',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <SignOffChip label="Content" signOff={row.original.contentSignOff} />
          <SignOffChip label="Fairness" signOff={row.original.fairnessSignOff} />
        </div>
      ),
    },
    {
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
      accessorKey: 'exposureCount',
      header: ({ column }) => <DataTableColumnHeader column={column} title="Exposures" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {row.original.exposureCount.toLocaleString('en-AU')}
        </span>
      ),
    },
    {
      id: 'formPlacements',
      enableSorting: false,
      header: 'In forms',
      cell: ({ row }) => {
        const placements = row.original.formPlacements
        if (placements.length === 0) {
          return <span className="text-caption text-muted-foreground">Not placed</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {placements.slice(0, 2).map((placement) => (
              <Badge key={placement} variant="outline" className="max-w-[12rem] truncate">
                {placement}
              </Badge>
            ))}
            {placements.length > 2 ? (
              <Badge variant="secondary" title={placements.join('\n')}>
                +{placements.length - 2}
              </Badge>
            ) : null}
          </div>
        )
      },
    },
  )

  return columns
}

export function ItemsTable({
  items,
  showFamily = false,
  emptyTitle = 'No items match',
  emptyDescription = 'Adjust the search to see more of the bank.',
  className,
}: {
  items: ItemRow[]
  showFamily?: boolean
  emptyTitle?: string
  emptyDescription?: string
  className?: string
}) {
  return (
    <div className={cn(className)}>
      <DataTable
        columns={buildColumns(showFamily)}
        data={items}
        searchableColumns={['stem', 'generatorSeed', 'familyCode']}
        searchPlaceholder="Search items"
        rowHref={(row) => `/item-bank/review/${row.id}`}
        getRowId={(row) => row.id}
        pageSize={25}
        emptyState={
          <EmptyState variant="item" size="sm" title={emptyTitle} description={emptyDescription} />
        }
      />
    </div>
  )
}
