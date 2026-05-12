'use client'

import { useEffect, useState, useTransition } from 'react'
import { Search } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getLinkedParticipants,
  searchPersons,
  linkParticipantsToSamePerson,
  unlinkParticipant,
  type LinkedParticipant,
  type PersonSearchResult,
} from '@/app/actions/trajectory'

/**
 * Drawer for managing the records linked to one person. Two affordances:
 * (1) unlink a row — re-randomises that row's person_key so it splits
 *     off as a new "person"; (2) merge another participant in by
 *     searching the rest of the client's participants and selecting one
 *     to absorb its person_key into this one.
 *
 * Actions are gated server-side to client_admin / platform_admin; non-
 * admin users see the rows but the buttons return an auth error if they
 * try to click (which is fine — they shouldn't be reaching this UI but
 * the server is the source of truth).
 */
export function TrajectoryLinkedRecordsDrawer({
  open,
  onOpenChange,
  campaignParticipantId,
  onAfterChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  campaignParticipantId: string
  onAfterChange?: () => void
}) {
  const [linked, setLinked] = useState<LinkedParticipant[] | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Merge-in search state — store the query that produced the results, so
  // we derive "should we show results" without writing to state on input.
  const [searchQuery, setSearchQuery] = useState('')
  const [searchRows, setSearchRows] = useState<{
    query: string
    rows: PersonSearchResult[]
  }>({ query: '', rows: [] })
  const [searching, setSearching] = useState(false)
  const loading = linked === null

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      try {
        const data = await getLinkedParticipants(campaignParticipantId)
        if (!cancelled) setLinked(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, campaignParticipantId])

  // Debounced search — the effect only mutates state inside async callbacks,
  // never in the synchronous effect body.
  useEffect(() => {
    if (!open) return
    const q = searchQuery.trim()
    if (q.length < 2) return // derive empty results below
    let cancelled = false
    const t = setTimeout(() => {
      void (async () => {
        setSearching(true)
        try {
          const rows = await searchPersons(q)
          if (cancelled) return
          const linkedKeys = new Set((linked ?? []).map((l) => l.campaignParticipantId))
          setSearchRows({
            query: q,
            rows: rows.filter((r) => !linkedKeys.has(r.campaignParticipantId)),
          })
        } catch {
          if (!cancelled) setSearchRows({ query: q, rows: [] })
        } finally {
          if (!cancelled) setSearching(false)
        }
      })()
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [searchQuery, open, linked])

  // Derived: only show the stored results if the current query still matches
  // what produced them and is long enough.
  const visibleSearchResults =
    searchQuery.trim().length >= 2 && searchRows.query === searchQuery.trim()
      ? searchRows.rows
      : []

  const refresh = async () => {
    setError(null)
    const fresh = await getLinkedParticipants(campaignParticipantId).catch(
      () => [] as LinkedParticipant[],
    )
    setLinked(fresh)
    onAfterChange?.()
  }

  const handleUnlink = (cpId: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await unlinkParticipant(cpId)
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unlink failed.')
      }
    })
  }

  const handleMergeIn = (sourceCpId: string) => {
    setError(null)
    startTransition(async () => {
      try {
        await linkParticipantsToSamePerson([sourceCpId], campaignParticipantId)
        setSearchQuery('')
        setSearchRows({ query: '', rows: [] })
        await refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Merge failed.')
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
        <SheetHeader>
          <SheetTitle>Linked records</SheetTitle>
          <SheetDescription>
            Participant rows that refer to the same human within this client.
            Unlink to split a row off as its own person; merge in to absorb
            another participant into this person.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 flex-1 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground">
              Currently linked
            </h4>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (linked ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No linked records.</p>
            ) : (
              <ul className="space-y-2">
                {(linked ?? []).map((row) => (
                  <li
                    key={row.campaignParticipantId}
                    className="rounded-md border border-border p-2.5 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {row.campaignTitle}
                        </div>
                        <div className="text-muted-foreground truncate">
                          {row.email}
                        </div>
                        <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                          {row.status} · {row.completedSessionCount}{' '}
                          {row.completedSessionCount === 1
                            ? 'completed session'
                            : 'completed sessions'}
                        </div>
                      </div>
                      {row.campaignParticipantId !== campaignParticipantId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => handleUnlink(row.campaignParticipantId)}
                          disabled={pending}
                        >
                          Unlink
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-xs uppercase tracking-widest text-muted-foreground">
              Merge another in
            </h4>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by name or email"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-xs"
              />
            </div>
            {searching && (
              <p className="text-[11px] text-muted-foreground">Searching…</p>
            )}
            {visibleSearchResults.length > 0 && (
              <ul className="space-y-1.5">
                {visibleSearchResults.slice(0, 8).map((r) => (
                  <li
                    key={r.campaignParticipantId}
                    className="rounded-md border border-border p-2 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{r.displayName}</div>
                        <div className="text-muted-foreground truncate">
                          {r.email} · {r.campaignTitle}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={() => handleMergeIn(r.campaignParticipantId)}
                        disabled={pending}
                      >
                        Merge in
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {searchQuery.trim().length >= 2 && !searching && visibleSearchResults.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No matches.</p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
