'use client'

import { useState, useTransition } from 'react'
import { getPersonTrajectory } from '@/app/actions/trajectory-data'
import { TrajectoryPersonHeader } from './trajectory-person-header'
import { TrajectoryControls } from './trajectory-controls'
import { TrajectoryChartGrid } from './trajectory-charts'
import { TrajectoryMatrix } from './trajectory-matrix'
import type {
  TrajectoryLevel,
  TrajectoryResult,
} from '@/lib/trajectory/types'

/**
 * Top-level Trajectory workspace. Renders the person header, controls,
 * and the active view (charts or matrix). Re-fetches via the server action
 * when the level changes; the assessment filter and view toggle are
 * client-side filters over the loaded data.
 */
export function TrajectoryWorkspace({
  campaignParticipantId,
  initialResult,
}: {
  campaignParticipantId: string
  initialResult: TrajectoryResult
}) {
  const [result, setResult] = useState<TrajectoryResult>(initialResult)
  const [view, setView] = useState<'charts' | 'matrix'>('charts')
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>(
    initialResult.assessmentsTouched.map((a) => a.assessmentId),
  )
  const [pending, startTransition] = useTransition()

  const setLevel = (next: TrajectoryLevel) => {
    if (next === result.level) return
    startTransition(async () => {
      const r = await getPersonTrajectory(campaignParticipantId, { level: next })
      setResult(r)
      // Recompute assessment selection — keep only those still present.
      setSelectedAssessmentIds((prev) =>
        r.assessmentsTouched.length === 0
          ? []
          : prev.filter((id) =>
              r.assessmentsTouched.some((a) => a.assessmentId === id),
            ).length > 0
          ? prev.filter((id) =>
              r.assessmentsTouched.some((a) => a.assessmentId === id),
            )
          : r.assessmentsTouched.map((a) => a.assessmentId),
      )
    })
  }

  // Filter series down to the selected assessments
  const filteredSeries = result.series
    .map((s) => ({
      ...s,
      points: s.points.filter((p) =>
        selectedAssessmentIds.includes(p.assessmentId),
      ),
    }))
    .filter((s) => s.points.length > 0)
    // Recompute the filtered series' deltas wouldn't be valid here without
    // re-running the rollup; for v1 we just hide series with no remaining
    // points and let the deltas reflect the full unfiltered history.

  const hasMultipleSessions = filteredSeries.some((s) => s.points.length >= 2)
  const hasAnyData = filteredSeries.length > 0

  return (
    <div className="space-y-4">
      <TrajectoryPersonHeader result={result} />

      <TrajectoryControls
        level={result.level}
        onLevelChange={setLevel}
        assessments={result.assessmentsTouched}
        selectedAssessmentIds={selectedAssessmentIds}
        onAssessmentsChange={setSelectedAssessmentIds}
        view={view}
        onViewChange={setView}
      />

      {pending && (
        <div className="text-xs text-muted-foreground italic px-1">
          Reloading at {result.level} level…
        </div>
      )}

      {!hasAnyData && (
        <EmptyState
          linkedCount={result.linkedParticipants.length}
          hasAnyTouched={result.assessmentsTouched.length > 0}
        />
      )}

      {hasAnyData && !hasMultipleSessions && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Snapshot view — trajectory becomes meaningful with 2+ completed sessions per entity.
        </div>
      )}

      {hasAnyData && view === 'charts' && (
        <TrajectoryChartGrid series={filteredSeries} />
      )}

      {hasAnyData && view === 'matrix' && (
        <TrajectoryMatrix series={filteredSeries} />
      )}
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
    message = 'No scores available at this level for the selected assessments.'
  }
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
