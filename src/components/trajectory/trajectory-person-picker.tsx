'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { searchPersons, type PersonSearchResult } from '@/app/actions/trajectory'

/**
 * Person picker for the standalone Trajectory page. Searches across the
 * caller's accessible clients (RLS in the server action does the scoping).
 * Selecting a result navigates to the same page with ?id=<campaignParticipantId>,
 * which causes the parent server component to render the workspace.
 */
export function TrajectoryPersonPicker({ basePath }: { basePath: string }) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<{ query: string; results: PersonSearchResult[] }>(
    { query: '', results: [] },
  )
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const results = await searchPersons(q)
          if (!cancelled) setRows({ query: q, results })
        } catch {
          if (!cancelled) setRows({ query: q, results: [] })
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query])

  const trimmed = query.trim()
  const visible = trimmed.length >= 2 && rows.query === trimmed ? rows.results : []

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-10"
          autoFocus
        />
      </div>

      {trimmed.length > 0 && trimmed.length < 2 && (
        <p className="text-xs text-muted-foreground">
          Enter at least 2 characters to search.
        </p>
      )}

      {searching && (
        <p className="text-xs text-muted-foreground">Searching…</p>
      )}

      {trimmed.length >= 2 && !searching && visible.length === 0 && (
        <p className="text-xs text-muted-foreground">No matches.</p>
      )}

      {visible.length > 0 && (
        <ul className="rounded-lg border border-border divide-y divide-border bg-card">
          {visible.slice(0, 20).map((r) => (
            <li key={r.campaignParticipantId}>
              <Link
                href={`${basePath}?id=${encodeURIComponent(r.campaignParticipantId)}`}
                className="block p-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-sm">{r.displayName}</span>
                  <span className="text-xs text-muted-foreground truncate">
                    {r.email}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground truncate">
                  {r.campaignTitle}
                  {r.lastActivityAt && (
                    <>
                      {' · '}
                      Last activity{' '}
                      {new Date(r.lastActivityAt).toLocaleDateString(undefined, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
