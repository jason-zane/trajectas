'use client'

import { useMemo, useState, useTransition } from 'react'
import { Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getPersonTrajectory } from '@/app/actions/trajectory-data'
import { TrajectoryPersonHeader } from './trajectory-person-header'
import { TrajectorySummaryPanel } from './trajectory-summary'
import { TrajectoryTimeline, type TimelineMode } from './trajectory-timeline'
import { TrajectoryMoversStrip } from './trajectory-movers'
import { TrajectoryDrillView } from './trajectory-drill-view'
import { TrajectoryMatrix } from './trajectory-matrix'
import { TrajectoryLinkedRecordsDrawer } from './trajectory-linked-records-drawer'
import type { TrajectoryResult, TrajectorySeries } from '@/lib/trajectory/types'

/**
 * Top-level Trajectory workspace.
 *
 * Layout (overview state):
 *   compact person header
 *   editorial summary panel
 *   optional assessment filter row
 *   hero timeline
 *   movers strip
 *   optional dense matrix view (toggle in header)
 *
 * Drill state replaces the body with a single-entity focused view.
 *
 * The level toggle from V1 is gone — overview is always dimension level;
 * deeper levels are reached through the drill (factor/construct drill is a
 * follow-up). Charts/matrix dual view is replaced by a single hero chart
 * with matrix demoted to a header toggle.
 */
export function TrajectoryWorkspace({
  campaignParticipantId,
  initialResult,
}: {
  campaignParticipantId: string
  initialResult: TrajectoryResult
}) {
  const [result, setResult] = useState<TrajectoryResult>(initialResult)
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>(
    initialResult.assessmentsTouched.map((a) => a.assessmentId),
  )
  const [mode, setMode] = useState<TimelineMode>('absolute')
  const [showMatrix, setShowMatrix] = useState(false)
  const [drillEntityId, setDrillEntityId] = useState<string | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [, startTransition] = useTransition()

  const refetch = () => {
    startTransition(async () => {
      const r = await getPersonTrajectory(campaignParticipantId, { level: 'dimension' })
      setResult(r)
    })
  }

  // Filter series down to the selected assessments
  const filteredSeries = useMemo<TrajectorySeries[]>(() => {
    if (selectedAssessmentIds.length === result.assessmentsTouched.length) {
      return result.series
    }
    return result.series
      .map((s) => ({
        ...s,
        points: s.points.filter((p) => selectedAssessmentIds.includes(p.assessmentId)),
      }))
      .filter((s) => s.points.length > 0)
  }, [result.series, result.assessmentsTouched.length, selectedAssessmentIds])

  const seriesById = useMemo(
    () => new Map(filteredSeries.map((s) => [s.entityId, s])),
    [filteredSeries],
  )

  const drillSeries = drillEntityId ? seriesById.get(drillEntityId) ?? null : null

  const hasMultipleSessions = filteredSeries.some((s) => s.points.length >= 2)
  const hasAnyData = filteredSeries.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TrajectoryPersonHeader
          result={result}
          onOpenLinkedRecords={() => setDrawerOpen(true)}
        />
        {hasAnyData && (
          <button
            type="button"
            onClick={() => setShowMatrix((v) => !v)}
            aria-pressed={showMatrix}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
              showMatrix
                ? 'border-foreground/30 bg-foreground/5 text-foreground'
                : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted',
            )}
          >
            <Table2 className="size-3.5" />
            Matrix
          </button>
        )}
      </div>

      <TrajectoryLinkedRecordsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        campaignParticipantId={campaignParticipantId}
        onAfterChange={refetch}
      />

      {!hasAnyData ? (
        <EmptyState
          linkedCount={result.linkedParticipants.length}
          hasAnyTouched={result.assessmentsTouched.length > 0}
        />
      ) : drillSeries ? (
        <TrajectoryDrillView
          series={drillSeries}
          mode={mode}
          onModeChange={setMode}
          onBack={() => setDrillEntityId(null)}
        />
      ) : (
        <>
          <TrajectorySummaryPanel
            displayName={result.displayName}
            summary={result.summary}
          />

          {result.assessmentsTouched.length > 1 && (
            <AssessmentFilter
              assessments={result.assessmentsTouched}
              selectedIds={selectedAssessmentIds}
              onChange={setSelectedAssessmentIds}
            />
          )}

          {hasMultipleSessions ? (
            <TrajectoryTimeline
              series={filteredSeries}
              mode={mode}
              onModeChange={setMode}
              onSeriesClick={(entityId) => setDrillEntityId(entityId)}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Snapshot view — trajectory becomes meaningful with 2+ completed sessions per dimension.
            </div>
          )}

          <TrajectoryMoversStrip
            summary={result.summary}
            seriesById={seriesById}
            onSelect={(entityId) => setDrillEntityId(entityId)}
          />

          {showMatrix && <TrajectoryMatrix series={filteredSeries} />}
        </>
      )}
    </div>
  )
}

function AssessmentFilter({
  assessments,
  selectedIds,
  onChange,
}: {
  assessments: TrajectoryResult['assessmentsTouched']
  selectedIds: string[]
  onChange: (ids: string[]) => void
}) {
  const allSelected = selectedIds.length === assessments.length

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1">
      <span className="text-overline text-muted-foreground mr-1">Assessments</span>
      <button
        type="button"
        onClick={() =>
          onChange(allSelected ? [] : assessments.map((a) => a.assessmentId))
        }
        className={cn(
          'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
          allSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-card hover:bg-muted',
        )}
      >
        All
      </button>
      {assessments.map((a) => {
        const active = selectedIds.includes(a.assessmentId)
        return (
          <button
            key={a.assessmentId}
            type="button"
            onClick={() =>
              onChange(
                active
                  ? selectedIds.filter((x) => x !== a.assessmentId)
                  : [...selectedIds, a.assessmentId],
              )
            }
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-[11px] transition-colors',
              active
                ? 'border-foreground/30 bg-foreground/5 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:bg-muted',
            )}
          >
            {a.assessmentName}
            <span className="ml-1 opacity-60 tabular-nums">{a.sessionCount}</span>
          </button>
        )
      })}
    </div>
  )
}

function EmptyState({
  linkedCount,
  hasAnyTouched,
}: {
  linkedCount: number
  hasAnyTouched: boolean
}) {
  let message: string
  if (linkedCount === 0) {
    message = 'No linked participant records.'
  } else if (!hasAnyTouched) {
    message = 'No completed sessions for this person yet.'
  } else {
    message = 'No scores available for the selected assessments.'
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
