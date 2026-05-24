'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Users, Lock, Globe2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/comparison/display'
import { AddParticipantDialog, type AddPickerSource } from './add-participant-dialog'
import { deleteSavedComparison } from '@/app/actions/saved-comparisons'
import { toast } from 'sonner'
import type { SavedComparisonSummary } from '@/lib/comparison/saved-types'

export function ComparisonEmptyState({
  basePath,
  savedComparisons,
  searchSource,
}: {
  basePath: string
  savedComparisons: SavedComparisonSummary[]
  searchSource: AddPickerSource
}) {
  const router = useRouter()
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<SavedComparisonSummary | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 pb-8 md:grid-cols-[1.1fr_1fr]">
      <section className="rounded-2xl border border-border bg-background p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-overline text-primary mb-1.5">Start a new comparison</p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Pick a participant to begin
          </h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            Add a participant and we&apos;ll pull their latest sessions across every
            assessment they&apos;ve completed. Add more to compare side by side, or
            stay on one person to see how they&apos;ve shifted over time.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="group flex w-full items-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 hover:border-primary/40"
        >
          <Search className="size-4 text-muted-foreground" />
          <span className="flex-1 text-sm text-muted-foreground">
            Search by name or email…
          </span>
          <kbd className="hidden rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline">
            ⏎
          </kbd>
        </button>

        <AddParticipantDialog
          open={showAdd}
          onClose={() => setShowAdd(false)}
          onAdd={(o) => {
            setShowAdd(false)
            const entries = JSON.stringify([{ campaignParticipantId: o.id }])
            router.push(`${basePath}?entries=${encodeURIComponent(entries)}`)
          }}
          searchSource={searchSource}
        />
      </section>

      <section className="rounded-2xl border border-border bg-muted/15 p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h3 className="text-sm font-semibold tracking-tight">Saved comparisons</h3>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {savedComparisons.length}
          </span>
        </div>

        {savedComparisons.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-6 text-center text-xs text-muted-foreground">
            Comparisons you save will show up here.
            <br />
            Share them with your team from the toolbar after saving.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {savedComparisons.map((c) => (
              <li key={c.id}>
                <SavedRow
                  comparison={c}
                  basePath={basePath}
                  onDelete={() => setConfirmDelete(c)}
                  busy={busyId === c.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        onConfirm={async () => {
          if (!confirmDelete) return
          setBusyId(confirmDelete.id)
          try {
            await deleteSavedComparison(confirmDelete.id)
            toast.success('Comparison deleted')
            router.refresh()
          } catch (e) {
            toast.error((e as Error).message)
          } finally {
            setBusyId(null)
            setConfirmDelete(null)
          }
        }}
        title="Delete this saved comparison?"
        description={
          confirmDelete
            ? `"${confirmDelete.name}" will be removed${
                confirmDelete.shareScope === 'team' ? ' for the whole team' : ''
              }.`
            : ''
        }
        confirmLabel="Delete"
        variant="destructive"
      />
    </div>
  )
}

function SavedRow({
  comparison,
  basePath,
  onDelete,
  busy,
}: {
  comparison: SavedComparisonSummary
  basePath: string
  onDelete: () => void
  busy: boolean
}) {
  const isShared = comparison.shareScope === 'team'
  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-lg border border-transparent bg-background px-3 py-2.5 transition-colors hover:border-border hover:shadow-sm',
        busy && 'opacity-50',
      )}
    >
      <Avatar size="sm" className="size-7">
        <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
          {getInitials(comparison.name, '')}
        </AvatarFallback>
      </Avatar>
      <Link
        href={`${basePath}?saved=${comparison.id}`}
        className="flex-1 min-w-0"
      >
        <div className="truncate text-sm font-medium">{comparison.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Users className="size-3" />
            {comparison.entryCount}
          </span>
          <span>·</span>
          <span>{comparison.assessmentCount} assessment{comparison.assessmentCount === 1 ? '' : 's'}</span>
          <span>·</span>
          <span className="inline-flex items-center gap-0.5">
            {isShared ? <Globe2 className="size-3" /> : <Lock className="size-3" />}
            {isShared ? 'Shared' : comparison.isOwn ? 'Private' : 'Theirs'}
          </span>
        </div>
      </Link>
      {comparison.isOwn && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 opacity-0 transition-opacity group-hover:opacity-100"
          onClick={onDelete}
          aria-label="Delete saved comparison"
          disabled={busy}
        >
          <Trash2 className="size-3.5" />
        </Button>
      )}
    </div>
  )
}
