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
  type EligibleAssessment,
} from '@/app/actions/comparison'
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
  searchSource: AddPickerSource
  currentUserId?: string | null
}

function encodeEntries(entries: EntryRequest[]): string {
  return encodeURIComponent(JSON.stringify(entries))
}

export function ComparisonWorkspace({
  initial,
  basePath,
  campaignSlug,
  partnerBandScheme,
  platformBandScheme,
  searchSource,
  currentUserId,
}: Props) {
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

  // When the parent server component re-renders with new `initial` props
  // (saved comparison loaded, navigated to ?entries=…, etc.), Next App
  // Router keeps this Client Component mounted, so local state would
  // otherwise stick to the first render's values. Resync on identity
  // change of `initial`.
  const initialRef = useRef(initial)
  useEffect(() => {
    if (initialRef.current !== initial) {
      initialRef.current = initial
      setRequest(initial.request)
      setResult(initial.result)
      setEligible(initial.eligible)
      setDeltaMode(initial.deltaMode ?? false)
    }
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

  function addEntry(cpId: string) {
    update({ ...request, entries: [...request.entries, { campaignParticipantId: cpId }] })
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
    <div className="space-y-4">
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
      <div className="px-4">
        {result.rows.length === 0 ? (
          <ComparisonEmptyState
            basePath={basePath}
            savedComparisons={initial.savedList ?? []}
            searchSource={searchSource}
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

      <AddParticipantDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onAdd={(o) => addEntry(o.id)}
        searchSource={searchSource}
      />

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
