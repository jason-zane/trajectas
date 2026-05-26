'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Search, ArrowUpRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { searchPersons, type PersonSearchResult, type TrajectoryLandingData } from '@/app/actions/trajectory'

/**
 * Trajectory landing — before a person has been selected.
 *
 *   ┌──────────────────────────────────────────┐
 *   │ Stat row (3 KPIs)                        │  (active people / sessions / last 30d)
 *   ├──────────────────────────────────────────┤
 *   │ Search input                             │
 *   ├──────────────────────────────────────────┤
 *   │ Recently active list, or search results  │
 *   └──────────────────────────────────────────┘
 *
 * The picker swaps between "recently active" (default) and "search results"
 * based on whether the user has typed >=2 characters.
 */
export function TrajectoryLanding({
  basePath,
  initial,
}: {
  basePath: string
  initial: TrajectoryLandingData
}) {
  const [query, setQuery] = useState('')
  const [rows, setRows] = useState<{ query: string; results: PersonSearchResult[] }>({
    query: '',
    results: [],
  })
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
  const isSearching = trimmed.length >= 2
  const visible = isSearching && rows.query === trimmed ? rows.results : []

  return (
    <div className="space-y-6 max-w-3xl">
      <LandingStats stats={initial.stats} />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 h-11"
          autoFocus
        />
      </div>

      {!isSearching ? (
        <RecentlyActive recent={initial.recent} basePath={basePath} />
      ) : (
        <SearchResults
          basePath={basePath}
          searching={searching}
          results={visible}
          query={trimmed}
        />
      )}
    </div>
  )
}

function LandingStats({ stats }: { stats: TrajectoryLandingData['stats'] }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard
        eyebrow="Active people"
        value={stats.peopleTracked}
        caption="with completed sessions"
      />
      <StatCard
        eyebrow="Sessions"
        value={stats.sessionsCompleted}
        caption="completed lifetime"
      />
      <StatCard
        eyebrow="Last 30 days"
        value={stats.sessionsLast30Days}
        caption={stats.sessionsLast30Days === 1 ? 'session' : 'sessions'}
      />
    </div>
  )
}

function StatCard({
  eyebrow,
  value,
  caption,
}: {
  eyebrow: string
  value: number
  caption: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-overline text-[var(--gold)] truncate">{eyebrow}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</p>
      <p className="text-caption text-muted-foreground mt-1 truncate">{caption}</p>
    </div>
  )
}

function RecentlyActive({
  recent,
  basePath,
}: {
  recent: PersonSearchResult[]
  basePath: string
}) {
  if (recent.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
        No completed sessions yet. As participants finish assessments their trajectories appear here.
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-overline text-[var(--gold)] px-1">Recently active</p>
      <ul className="rounded-xl border border-border bg-card overflow-hidden">
        {recent.map((r) => (
          <li key={r.campaignParticipantId}>
            <PersonRow row={r} basePath={basePath} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function SearchResults({
  basePath,
  searching,
  results,
  query,
}: {
  basePath: string
  searching: boolean
  results: PersonSearchResult[]
  query: string
}) {
  if (searching && results.length === 0) {
    return <p className="text-caption text-muted-foreground px-1">Searching…</p>
  }
  if (!searching && results.length === 0) {
    return (
      <p className="text-caption text-muted-foreground px-1">
        No matches for &ldquo;{query}&rdquo;.
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <p className="text-overline text-[var(--gold)] px-1">
        {results.length} match{results.length === 1 ? '' : 'es'}
      </p>
      <ul className="rounded-xl border border-border bg-card overflow-hidden">
        {results.slice(0, 20).map((r) => (
          <li key={r.campaignParticipantId}>
            <PersonRow row={r} basePath={basePath} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function PersonRow({ row, basePath }: { row: PersonSearchResult; basePath: string }) {
  return (
    <Link
      href={`${basePath}?id=${encodeURIComponent(row.campaignParticipantId)}`}
      className={cn(
        'group relative flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-b-0',
        'hover:bg-[var(--cream)] dark:hover:bg-muted/40 transition-colors',
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-0.5 bg-[var(--gold)] origin-top scale-y-0 group-hover:scale-y-100 transition-transform duration-200"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-sm truncate">{row.displayName}</span>
          <span className="text-caption text-muted-foreground truncate min-w-0">
            {row.email}
          </span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground truncate">
          {row.campaignTitle}
          {row.lastActivityAt && (
            <>
              {' · Last session '}
              {formatRelative(row.lastActivityAt)}
            </>
          )}
        </p>
      </div>
      <ArrowUpRight
        aria-hidden
        className="size-4 text-muted-foreground group-hover:text-foreground transition-colors translate-y-px shrink-0"
      />
    </Link>
  )
}

function formatRelative(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const now = Date.now()
  const diffDays = Math.round((now - t) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.round(diffDays / 7)}w ago`
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
