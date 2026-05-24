'use client'
import { useEffect, useState } from 'react'
import { Building2, Calendar, CheckCircle2 } from 'lucide-react'
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
  onAdd: (option: AddPickerOption) => void
  searchSource: AddPickerSource
}) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<AddPickerOption[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)

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

  if (!open) return null
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
            <h3 className="text-sm font-semibold">Pick a participant</h3>
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
            One row per campaign — pick the version of this person you want to compare.
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
                onClick={() => {
                  onAdd(o)
                  onClose()
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PickerRow({
  option,
  onClick,
}: {
  option: AddPickerOption
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
      className={cn(
        'group flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        'hover:bg-muted focus-visible:bg-muted focus-visible:outline-none',
      )}
      onClick={onClick}
    >
      <Avatar size="sm" className="mt-0.5 size-8">
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
