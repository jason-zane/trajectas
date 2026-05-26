'use client'
import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ComparisonSelectionBar } from './comparison-selection-bar'
import { ComparisonMatrix } from './comparison-matrix'
import { AddParticipantDialog, type AddPickerSource } from './add-participant-dialog'
import { ComparisonRowSessionPopover } from './comparison-row-session-popover'
import { ComparisonEmptyState } from './comparison-empty-state'
import { ComparisonSaveMenu } from './comparison-save-menu'
import type {
  SavedComparison,
  SavedComparisonSummary,
} from '@/lib/comparison/saved-types'
import { buildCellStyleResolver } from '@/lib/comparison/resolve-bands'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
  searchAllParticipants,
  searchCampaignParticipants,
  type EligibleAssessment,
} from '@/app/actions/comparison'

/**
 * Picker scope is captured as serializable data, not a closure. We can't
 * pass a non-`use server` function from a Server Component to this Client
 * Component (Next.js throws "Functions cannot be passed directly to Client
 * Components"). The closure that the dialog actually consumes is built
 * inside this component so it lives entirely on the client.
 */
export type PickerScope =
  | { kind: 'all' }
  | { kind: 'campaign'; campaignId: string }
import type { BandScheme } from '@/lib/reports/band-scheme'
import { DEFAULT_VISIBLE_LEVELS } from '@/lib/comparison/url-params'
import { isLongitudinal } from '@/lib/comparison/display'
import type {
  ColumnLevel,
  ComparisonRequest,
  ComparisonResult,
  EntryRequest,
} from '@/lib/comparison/types'

type Props = {
  initial: {
    request: ComparisonRequest
    result: ComparisonResult
    eligible: EligibleAssessment[]
    deltaMode?: boolean
    saved?: SavedComparison | null
    savedList?: SavedComparisonSummary[]
  }
  basePath: string
  campaignSlug?: string
  partnerBandScheme: BandScheme | null
  platformBandScheme: BandScheme | null
  pickerScope: PickerScope
  currentUserId?: string | null
}

function encodeEntries(entries: EntryRequest[]): string {
  return encodeURIComponent(JSON.stringify(entries))
}

function requestSignature(req: ComparisonRequest, delta: boolean): string {
  return JSON.stringify({
    e: req.entries,
    a: req.assessmentIds,
    l: req.visibleLevels ?? [],
    d: delta,
  })
}

export function ComparisonWorkspace({
  initial,
  basePath,
  campaignSlug,
  partnerBandScheme,
  platformBandScheme,
  pickerScope,
  currentUserId,
}: Props) {
  const searchSource: AddPickerSource = useMemo(
    () =>
      pickerScope.kind === 'campaign'
        ? (query) => searchCampaignParticipants(pickerScope.campaignId, query)
        : (query) => searchAllParticipants(query),
    [pickerScope],
  )
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()

  const [request, setRequest] = useState<ComparisonRequest>(initial.request)
  const [result, setResult] = useState<ComparisonResult>(initial.result)
  const [eligible, setEligible] = useState<EligibleAssessment[]>(initial.eligible)
  const [showAdd, setShowAdd] = useState(false)
  const [popover, setPopover] = useState<{ entryId: string; cpId: string } | null>(null)
  const [deltaMode, setDeltaMode] = useState<boolean>(initial.deltaMode ?? false)

  // Resync local state when `initial` props meaningfully differ from local
  // state. This handles back/forward navigation and loading a saved
  // comparison via ?saved=… while the workspace is already mounted.
  //
  // We compare by *content signature*, not object identity. The previous
  // identity check created a render storm because every URL writeback
  // produced a fresh `initial` reference on the next server render, which
  // looked like a change-to-resync and queued more URL writebacks.
  //
  // When the local state already matches the URL (the common case after a
  // workspace-initiated change), the signatures match and we skip the
  // setters entirely.
  const lastSyncedSig = useRef(requestSignature(initial.request, initial.deltaMode ?? false))
  useEffect(() => {
    const incomingSig = requestSignature(initial.request, initial.deltaMode ?? false)
    const localSig = requestSignature(request, deltaMode)
    if (incomingSig !== localSig && incomingSig !== lastSyncedSig.current) {
      lastSyncedSig.current = incomingSig
      setRequest(initial.request)
      setResult(initial.result)
      setEligible(initial.eligible)
      setDeltaMode(initial.deltaMode ?? false)
    } else {
      lastSyncedSig.current = incomingSig
    }
    // We only depend on `initial`; `request`/`deltaMode` reads are intentionally
    // current-render snapshots, not effect deps, to avoid retriggering on every
    // local change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])

  const longitudinal = useMemo(() => isLongitudinal(result.rows), [result.rows])

  const getCellStyle: (score: number | null) => CSSProperties = useMemo(
    () =>
      buildCellStyleResolver({
        partner: { bandScheme: partnerBandScheme },
        platform: { bandScheme: platformBandScheme },
      }),
    [partnerBandScheme, platformBandScheme],
  )

  const visibleLevels = request.visibleLevels ?? [...DEFAULT_VISIBLE_LEVELS]

  useEffect(() => {
    const next = new URLSearchParams(params)
    next.set('entries', encodeEntries(request.entries))
    next.set('assessments', request.assessmentIds.join(','))
    next.set('levels', visibleLevels.join(','))
    if (deltaMode) next.set('delta', '1')
    else next.delete('delta')
    next.delete('granularity')
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    // We deliberately omit `params` to avoid an update loop when router.replace
    // changes the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, deltaMode, pathname, router])

  function refetch(nextRequest: ComparisonRequest) {
    startTransition(async () => {
      const [r, e] = await Promise.all([
        getComparisonMatrix(nextRequest),
        getEligibleAssessmentsForParticipants(
          nextRequest.entries.map((x) => x.campaignParticipantId),
        ),
      ])
      setResult(r)
      setEligible(e)
    })
  }

  function update(req: ComparisonRequest) {
    setRequest(req)
    refetch(req)
  }

  function addEntries(cpIds: string[]) {
    if (cpIds.length === 0) return
    const existing = new Set(request.entries.map((e) => e.campaignParticipantId))
    const additions = cpIds
      .filter((id) => !existing.has(id))
      .map((id) => ({ campaignParticipantId: id }))
    if (additions.length === 0) return
    update({ ...request, entries: [...request.entries, ...additions] })
  }

  function removeEntry(entryId: string) {
    const idx = result.rows.findIndex((r) => r.entryId === entryId)
    if (idx < 0) return
    update({ ...request, entries: request.entries.filter((_, i) => i !== idx) })
  }

  function toggleAssessment(aId: string) {
    const next = request.assessmentIds.includes(aId)
      ? request.assessmentIds.filter((x) => x !== aId)
      : [...request.assessmentIds, aId]
    update({ ...request, assessmentIds: next })
  }

  function toggleLevel(level: ColumnLevel) {
    const current = request.visibleLevels ?? [...DEFAULT_VISIBLE_LEVELS]
    const next = current.includes(level)
      ? current.filter((l) => l !== level)
      : [...current, level]
    if (next.length === 0) return
    update({ ...request, visibleLevels: next })
  }

  function changeRowSession(entryId: string, assessmentId: string, sessionId: string) {
    const idx = result.rows.findIndex((r) => r.entryId === entryId)
    if (idx < 0) return
    const newEntries = request.entries.map((e, i) => {
      if (i !== idx) return e
      return {
        ...e,
        sessionIdsByAssessment: { ...(e.sessionIdsByAssessment ?? {}), [assessmentId]: sessionId },
      }
    })
    update({ ...request, entries: newEntries })
  }

  const savedSummary = initial.saved
    ? {
        id: initial.saved.id,
        name: initial.saved.name,
        shareScope: initial.saved.shareScope,
        isOwn: currentUserId ? initial.saved.ownerId === currentUserId : false,
      }
    : null

  return (
    <div className="space-y-4 min-w-0">
      {request.entries.length > 0 && (
        <ComparisonSelectionBar
          rows={result.rows}
          request={request}
          visibleLevels={visibleLevels}
          campaignSlug={campaignSlug}
          eligibleAssessments={eligible}
          deltaMode={deltaMode}
          longitudinal={longitudinal}
          onRemoveEntry={removeEntry}
          onAddEntryClick={() => setShowAdd(true)}
          onToggleAssessment={toggleAssessment}
          onToggleLevel={toggleLevel}
          onToggleDelta={() => setDeltaMode((v) => !v)}
          saveSlot={
            <ComparisonSaveMenu
              entries={request.entries}
              assessmentIds={request.assessmentIds}
              visibleLevels={visibleLevels}
              deltaMode={deltaMode}
              saved={savedSummary}
              basePath={basePath}
            />
          }
        />
      )}
      {pending && (
        <div className="px-4 text-xs text-muted-foreground">Updating…</div>
      )}
      {/*
       * grid-cols-[minmax(0,1fr)] is the bulletproof way to stop a wide
       * child from forcing its parent wider. `min-w-0` on a block child
       * is a no-op; the matrix table only honours its overflow-x-auto
       * if the grid track is explicitly width-capped to "no wider than
       * the parent's available space".
       */}
      <div className="px-4 grid grid-cols-[minmax(0,1fr)]">
        {result.rows.length === 0 ? (
          <ComparisonEmptyState
            basePath={basePath}
            savedComparisons={initial.savedList ?? []}
            searchSource={searchSource}
            onAddEntries={addEntries}
          />
        ) : (
          <ComparisonMatrix
            data={result}
            visibleLevels={visibleLevels}
            getCellStyle={getCellStyle}
            deltaMode={deltaMode}
            longitudinal={longitudinal}
            onChangeRowSession={(entryId) => {
              const row = result.rows.find((r) => r.entryId === entryId)
              if (!row) return
              setPopover({ entryId, cpId: row.campaignParticipantId })
            }}
          />
        )}
      </div>

      {showAdd && (
        <AddParticipantDialog
          open
          onClose={() => setShowAdd(false)}
          onAdd={(opts) => addEntries(opts.map((o) => o.id))}
          searchSource={searchSource}
        />
      )}

      {popover && (
        <ComparisonRowSessionPopover
          campaignParticipantId={popover.cpId}
          assessmentIds={request.assessmentIds}
          open={true}
          onClose={() => setPopover(null)}
          onPick={(aId, sId) => {
            changeRowSession(popover.entryId, aId, sId)
            setPopover(null)
          }}
        />
      )}
    </div>
  )
}
