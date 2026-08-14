'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteInstrumentBuild } from '@/app/actions/instrument'
import type { InstrumentBuildDto } from '@/lib/dal/instrument-mappers'
import {
  DataTable,
  DataTableActionsMenu,
  DataTableColumnHeader,
  DataTableRowLink,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { formatDate } from '@/lib/formatting'

const STATUS_VARIANT: Record<
  string,
  'secondary' | 'default' | 'outline' | 'destructive'
> = {
  draft: 'secondary',
  blueprinting: 'outline',
  generating: 'outline',
  reviewing: 'outline',
  ready: 'default',
  published: 'default',
  failed: 'destructive',
}

const columns: ColumnDef<InstrumentBuildDto>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Name' />
    ),
    cell: ({ row }) => (
      <DataTableRowLink
        href={`/instruments/${row.original.id}`}
        ariaLabel={`Open ${row.original.name}`}
        className='min-w-0'
      >
        <p className='truncate font-semibold text-foreground hover:text-primary'>
          {row.original.name}
        </p>
      </DataTableRowLink>
    ),
  },
  {
    accessorKey: 'measureType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Measure Type' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {row.original.measureType.replace(/_/g, ' ')}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => (
      <Badge variant={STATUS_VARIANT[row.original.status] ?? 'secondary'}>
        {row.original.status}
      </Badge>
    ),
  },
  {
    id: 'constructs',
    accessorFn: (row) => row.targetConstructCount ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Target Constructs' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums text-sm text-muted-foreground'>
        {row.original.targetConstructCount ?? '—'}
      </span>
    ),
  },
  {
    id: 'items',
    accessorFn: (row) => row.targetItemsPerConstruct ?? 0,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Items per Construct' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums text-sm text-muted-foreground'>
        {row.original.targetItemsPerConstruct ?? '—'}
      </span>
    ),
  },
  {
    id: 'created',
    accessorFn: (row) => row.createdAt,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Created' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {formatDate(row.original.createdAt)}
      </span>
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => <InstrumentRowActions build={row.original} />,
  },
]

function InstrumentRowActions({ build }: { build: InstrumentBuildDto }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteInstrumentBuild(build.id)
        toast.success('Instrument build deleted')
        setOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to delete instrument build'
        )
      }
    })
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for ${build.name}`}>
        <DropdownMenuItem onClick={() => router.push(`/instruments/${build.id}`)}>
          <ExternalLink className='size-4' />
          Open build
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setOpen(true)}
          disabled={isPending}
          variant='destructive'
        >
          <Trash2 className='size-4' />
          Delete build
        </DropdownMenuItem>
      </DataTableActionsMenu>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title='Delete instrument build?'
        description={`Delete "${build.name}". This removes it from the list, but the action can still be undone later.`}
        confirmLabel='Delete'
        variant='destructive'
        onConfirm={handleDelete}
        loading={isPending}
      />
    </>
  )
}

const statusFilter = [
  { label: 'Draft', value: 'draft' },
  { label: 'Blueprinting', value: 'blueprinting' },
  { label: 'Generating', value: 'generating' },
  { label: 'Reviewing', value: 'reviewing' },
  { label: 'Ready', value: 'ready' },
  { label: 'Published', value: 'published' },
  { label: 'Failed', value: 'failed' },
]

export function InstrumentsDataTable({ builds }: { builds: InstrumentBuildDto[] }) {
  return (
    <DataTable
      columns={columns}
      data={builds}
      searchableColumns={['name']}
      searchPlaceholder='Search instruments'
      filterableColumns={[
        {
          id: 'status',
          title: 'Status',
          options: statusFilter,
        },
      ]}
      defaultSort={{ id: 'created', desc: true }}
      rowHref={(row) => `/instruments/${row.id}`}
      pageSize={20}
    />
  )
}
