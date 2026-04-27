'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export type AddPickerOption = { id: string; name: string; email: string }
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

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const id = setTimeout(async () => {
      const opts = await searchSource(query)
      if (!cancelled) setOptions(opts)
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
      className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-12"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Add participant</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          className="w-full rounded-md border border-input px-3 py-2 text-sm bg-background"
        />
        <ul className="mt-3 max-h-80 overflow-auto text-sm">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                className="w-full text-left rounded px-3 py-2 hover:bg-muted"
                onClick={() => {
                  onAdd(o)
                  onClose()
                }}
              >
                <div className="font-medium">{o.name}</div>
                <div className="opacity-70 text-xs">{o.email}</div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
