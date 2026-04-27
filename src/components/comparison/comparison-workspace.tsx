'use client'
import { useEffect, useMemo, useState, useTransition, type CSSProperties } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ComparisonSelectionBar } from './comparison-selection-bar'
import { ComparisonMatrix } from './comparison-matrix'
import { AddParticipantDialog, type AddPickerSource } from './add-participant-dialog'
import { ComparisonRowSessionPopover } from './comparison-row-session-popover'
import { buildCellStyleResolver } from '@/lib/comparison/resolve-bands'
import {
  getComparisonMatrix,
  getEligibleAssessmentsForParticipants,
  type EligibleAssessment,
} from '@/app/actions/comparison'
import type { BandScheme } from '@/lib/reports/band-scheme'
import { DEFAULT_VISIBLE_LEVELS } from '@/lib/comparison/url-params'
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
  }
  campaignSlug?: string
  partnerBandScheme: BandScheme | null
  platformBandScheme: BandScheme | null
  searchSource: AddPickerSource
}

function encodeEntries(entries: EntryRequest[]): string {
  return encodeURIComponent(JSON.stringify(entries))
}

export function ComparisonWorkspace({
  initial,
  campaignSlug,
  partnerBandScheme,
  platformBandScheme,
  searchSource,
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
    next.delete('granularity')
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
    // We deliberately omit `params` to avoid an update loop when router.replace
    // changes the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, pathname, router])

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

  return (
    <div className="space-y-4">
      <ComparisonSelectionBar
        rows={result.rows}
        request={request}
        visibleLevels={visibleLevels}
        campaignSlug={campaignSlug}
        eligibleAssessments={eligible}
        onRemoveEntry={removeEntry}
        onAddEntryClick={() => setShowAdd(true)}
        onToggleAssessment={toggleAssessment}
        onToggleLevel={toggleLevel}
      />
      {pending && <div className="text-xs opacity-60 px-4">Updating…</div>}
      <div className="px-4">
        {result.rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm opacity-70">
            No participants selected — add one to start.
          </div>
        ) : (
          <ComparisonMatrix
            data={result}
            visibleLevels={visibleLevels}
            getCellStyle={getCellStyle}
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
