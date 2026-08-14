'use client'

/**
 * calibration-runs-list.tsx — Calibration run history and management.
 *
 * Displays a data table of all calibration runs with metadata (label, date,
 * status, sample size, etc.) and row actions for delete and rename.
 *
 * Uses the shared DataTable component per ui-standards. Client-only with
 * no server-side imports.
 */

import { useState, useTransition } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Trash2, Edit2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

import type { CalibrationRunSummary } from '@/lib/dal/calibration'
import { deleteCalibrationRun, labelCalibrationRun } from '@/app/actions/psychometrics'
import {
  DataTable,
  DataTableColumnHeader,
  DataTableActionsMenu,
} from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDate } from '@/lib/formatting'

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'outline' | 'destructive'
> = {
  running: 'outline',
  completed: 'default',
  failed: 'destructive',
}

const RUN_TYPE_LABELS: Record<string, string> = {
  initial: 'Initial',
  monitoring: 'Monitoring',
  recalibration: 'Recalibration',
  on_demand: 'On Demand',
}

const columns: ColumnDef<CalibrationRunSummary>[] = [
  {
    accessorKey: 'label',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Label' />
    ),
    cell: ({ row }) => (
      <span className='font-semibold text-foreground'>
        {row.original.label || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {formatDate(row.original.createdAt)}
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
    accessorKey: 'runType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Type' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {RUN_TYPE_LABELS[row.original.runType] ?? row.original.runType}
      </span>
    ),
  },
  {
    id: 'sampleSize',
    accessorKey: 'sampleSize',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Sample Size' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums text-sm text-muted-foreground'>
        {row.original.sampleSize ?? '—'}
      </span>
    ),
  },
  {
    id: 'sessionCount',
    accessorKey: 'sessionCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Sessions' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums text-sm text-muted-foreground'>
        {row.original.sessionCount ?? '—'}
      </span>
    ),
  },
  {
    id: 'includeInternal',
    accessorFn: (row) => row.includeInternal ? 'yes' : 'no',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Internal Data' />
    ),
    cell: ({ row }) => (
      <span className='text-sm text-muted-foreground'>
        {row.original.includeInternal ? 'Yes' : 'No'}
      </span>
    ),
  },
  {
    id: 'itemStats',
    accessorKey: 'itemStatisticsCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Item Stats' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums text-sm text-muted-foreground'>
        {row.original.itemStatisticsCount ?? '—'}
      </span>
    ),
  },
  {
    id: 'constructs',
    accessorKey: 'constructReliabilityCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Constructs' />
    ),
    cell: ({ row }) => (
      <span className='tabular-nums text-sm text-muted-foreground'>
        {row.original.constructReliabilityCount ?? '—'}
      </span>
    ),
  },
  {
    id: 'actions',
    enableSorting: false,
    cell: ({ row }) => <CalibrationRunRowActions run={row.original} />,
  },
]

function CalibrationRunRowActions({ run }: { run: CalibrationRunSummary }) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [newLabel, setNewLabel] = useState(run.label || '')
  const [isPending, startTransition] = useTransition()

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteCalibrationRun(run.id)
        toast.success('Calibration run deleted', {
          action: { label: 'Undo', onClick: () => {} },
          duration: 5000,
        })
        setDeleteOpen(false)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to delete calibration run'
        )
      }
    })
  }

  function handleRename() {
    startTransition(async () => {
      try {
        await labelCalibrationRun(run.id, newLabel.trim())
        toast.success('Calibration run label updated')
        setRenameOpen(false)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update label'
        )
      }
    })
  }

  return (
    <>
      <DataTableActionsMenu label={`Open actions for run ${run.createdAt}`}>
        <DropdownMenuItem
          onClick={() => setRenameOpen(true)}
          disabled={isPending}
        >
          <Edit2 className='size-4' />
          Rename
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => setDeleteOpen(true)}
          disabled={isPending}
          variant='destructive'
        >
          <Trash2 className='size-4' />
          Delete
        </DropdownMenuItem>
      </DataTableActionsMenu>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title='Delete calibration run?'
        description='This removes the run from the list. You can undo this action.'
        confirmLabel='Delete'
        variant='destructive'
        onConfirm={handleDelete}
        loading={isPending}
      />

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename calibration run</DialogTitle>
            <DialogDescription>
              Give this run a descriptive label for future reference.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='label'>Label</Label>
              <Input
                id='label'
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder='e.g., Q4 2024 Recalibration'
                disabled={isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setRenameOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={isPending || !newLabel.trim()}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface CalibrationRunsListProps {
  runs: CalibrationRunSummary[]
}

export function CalibrationRunsList({ runs }: CalibrationRunsListProps) {
  // Separate failed runs to show errors prominently
  const failedRuns = runs.filter((r) => r.status === 'failed')
  const otherRuns = runs.filter((r) => r.status !== 'failed')

  return (
    <div className='space-y-6'>
      {/* Failed runs alert */}
      {failedRuns.length > 0 && (
        <Alert variant='destructive'>
          <AlertTriangle className='h-4 w-4' />
          <AlertDescription>
            <p className='font-medium mb-2'>
              {failedRuns.length} run{failedRuns.length === 1 ? '' : 's'} failed
            </p>
            {failedRuns.map((run) => (
              <div key={run.id} className='text-sm'>
                <p className='font-mono text-xs'>
                  {formatDate(run.createdAt)}: {run.errorMessage || 'Unknown error'}
                </p>
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Runs table */}
      <DataTable
        columns={columns}
        data={otherRuns}
        searchableColumns={['label']}
        searchPlaceholder='Search runs by label'
        filterableColumns={[
          {
            id: 'status',
            title: 'Status',
            options: [
              { label: 'Completed', value: 'completed' },
              { label: 'Running', value: 'running' },
            ],
          },
          {
            id: 'runType',
            title: 'Type',
            options: [
              { label: 'Initial', value: 'initial' },
              { label: 'Monitoring', value: 'monitoring' },
              { label: 'Recalibration', value: 'recalibration' },
              { label: 'On Demand', value: 'on_demand' },
            ],
          },
        ]}
        defaultSort={{ id: 'createdAt', desc: true }}
        pageSize={20}
      />
    </div>
  )
}
