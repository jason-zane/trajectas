'use client'
import { useEffect, useMemo, useState } from 'react'
import { Building2, Calendar, Check, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/comparison/display'

export type AddPickerOption = {
  id: string
  name: string
  email: string
  campaignId?: string
  campaignTitle?: string
  sessionCount?: number
  completedSessionCount?: number
  latestActivityAt?: string | null
}
export type AddPickerSource = (query: string) => Promise<AddPickerOption[]>

export function AddParticipantDialog({
  open,
  onClose,
  onAdd,
  searchSource,
}: {
  open: boolean
  onClose: () => void
  /**
   * Called with every selected option when the user commits the picker.
   * Always an array — single-pick callers just take the first entry.
   */
  onAdd: (options: AddPickerOption[]) => void
  searchSource: AddPickerSource
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<AddPickerOption[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Stash the full option objects so picks survive a search re-query that
  // drops them from `options`. Without this, switching the search term
  // after picking someone would lose their full payload at commit time.
  const [selectedById, setSelectedById] = useState<Record<string, AddPickerOption>>({})

  // Parents conditionally render this dialog, so every open is a fresh mount
  // and state is naturally reset — no need to clear it from the effect.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = setTimeout(async () => {
      const opts = await searchSource(query)
      if (!cancelled) {
        setOptions(opts)
        setHasLoaded(true)
      }
    }, 150)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [open, query, searchSource])

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])

  function toggle(option: AddPickerOption) {
    setSelectedIds((prev) =>
      prev.includes(option.id) ? prev.filter((x) => x !== option.id) : [...prev, option.id],
    )
    setSelectedById((prev) => ({ ...prev, [option.id]: option }))
  }

  function commit() {
    const picked = selectedIds.map((id) => selectedById[id]).filter(Boolean)
    if (picked.length === 0) return
    onAdd(picked)
    onClose()
  }

  if (!open) return null
  const count = selectedIds.length
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add participant"
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/40 p-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="mt-16 w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex flex-col">
            <p className="text-overline text-primary">Add</p>
            <h3 className="text-sm font-semibold">Pick participants</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="border-b border-border px-5 py-3">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            One row per campaign — tick everyone you want to compare, then add them all at once.
          </p>
        </div>
        <ul className="max-h-96 overflow-auto p-2 text-sm">
          {!hasLoaded && options.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Searching…
            </li>
          )}
          {hasLoaded && options.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matching participants.
            </li>
          )}
          {options.map((o) => (
            <li key={o.id}>
              <PickerRow
                option={o}
                selected={selectedSet.has(o.id)}
                onClick={() => toggle(o)}
              />
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {count === 0 ? 'No participants selected' : `${count} selected`}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={commit} disabled={count === 0}>
              {count <= 1 ? 'Add participant' : `Add ${count} participants`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PickerRow({
  option,
  selected,
  onClick,
}: {
  option: AddPickerOption
  selected: boolean
  onClick: () => void
}) {
  const dateLabel = option.latestActivityAt
    ? new Date(option.latestActivityAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const sessionLabel = (() => {
    if (option.sessionCount === undefined) return null
    if (option.sessionCount === 0) return 'No sessions yet'
    if ((option.completedSessionCount ?? 0) === option.sessionCount) {
      return `${option.sessionCount} session${option.sessionCount === 1 ? '' : 's'}`
    }
    return `${option.completedSessionCount ?? 0}/${option.sessionCount} completed`
  })()
  const fullyComplete =
    option.sessionCount !== undefined &&
    option.sessionCount > 0 &&
    option.completedSessionCount === option.sessionCount
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
        selected && 'bg-primary/10 hover:bg-primary/15',
      )}
      onClick={onClick}
    >
      <span
        aria-hidden
        className={cn(
          'mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
          selected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-background group-hover:border-foreground/40',
        )}
      >
        {selected && <Check className="size-3" strokeWidth={3} />}
      </span>
      <Avatar size="sm" className="size-8">
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(option.name, option.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{option.name}</span>
          {dateLabel && (
            <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
              {dateLabel}
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">{option.email}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
          {option.campaignTitle && (
            <span className="inline-flex items-center gap-1">
              <Building2 className="size-3" />
              <span className="max-w-[180px] truncate">{option.campaignTitle}</span>
            </span>
          )}
          {sessionLabel && (
            <span className="inline-flex items-center gap-1">
              {fullyComplete ? (
                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Calendar className="size-3" />
              )}
              {sessionLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}
