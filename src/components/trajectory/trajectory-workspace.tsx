'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Table2 } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getPersonTrajectory } from '@/app/actions/trajectory-data'
import { computeTrajectorySummary } from '@/lib/trajectory/rollup'
import { TrajectoryPersonHeader } from './trajectory-person-header'
import { TrajectorySummaryPanel } from './trajectory-summary'
import { TrajectoryTimeline, type TimelineMode } from './trajectory-timeline'
import { TrajectoryMoversStrip } from './trajectory-movers'
import { TrajectoryDrillView, type DrillFrame } from './trajectory-drill-view'
import { TrajectoryMatrix } from './trajectory-matrix'
import { TrajectoryLinkedRecordsDrawer } from './trajectory-linked-records-drawer'
import {
  decodeTrajectoryParams,
  encodeTrajectoryParams,
} from '@/lib/trajectory/url-params'
import type {
  TrajectoryLevel,
  TrajectoryResult,
  TrajectorySeries,
} from '@/lib/trajectory/types'

const CHILD_OF_LEVEL: Record<TrajectoryLevel, TrajectoryLevel | null> = {
  dimension: 'factor',
  factor: 'construct',
  construct: null,
}

/**
 * Top-level Trajectory workspace.
 *
 * Overview: editorial summary + hero timeline + movers strip (+ optional matrix).
 * Drill: stack-based; each frame loads its level on demand and caches the result
 * in workspace state. Breadcrumb lets the user pop to any prior depth.
 *
 * URL state encodes the drill chain, timeline mode, matrix toggle, and the
 * assessment filter so views are shareable across reloads.
 */
export function TrajectoryWorkspace({
  campaignParticipantId,
  initialResult,
}: {
  campaignParticipantId: string
  initialResult: TrajectoryResult
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Read initial state from URL on first render only; subsequent URL changes
  // are driven by state, not the other way around. useState's init function
  // runs exactly once, so this is safe under the React Compiler.
  const [initialUrl] = useState(() => decodeTrajectoryParams(searchParams))

  // Cache: trajectory result per level. Seeded with the dimension-level result.
  const [resultsByLevel, setResultsByLevel] = useState<
    Partial<Record<TrajectoryLevel, TrajectoryResult>>
  >({ dimension: initialResult })

  const [drillStack, setDrillStack] = useState<DrillFrame[]>([])
  const [mode, setMode] = useState<TimelineMode>(initialUrl.mode)
  const [showMatrix, setShowMatrix] = useState<boolean>(initialUrl.matrix)
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<string[]>(
    initialUrl.assessmentIds ?? initialResult.assessmentsTouched.map((a) => a.assessmentId),
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const ensureLevel = useCallback(
    async (level: TrajectoryLevel): Promise<TrajectoryResult> => {
      const cached = resultsByLevel[level]
      if (cached) return cached
      const fresh = await getPersonTrajectory(campaignParticipantId, { level })
      setResultsByLevel((prev) => ({ ...prev, [level]: fresh }))
      return fresh
    },
    [campaignParticipantId, resultsByLevel],
  )

  // Rehydrate drill stack from URL once we know level results are loadable.
  // Walks the entity-id chain: at each step we ensure the level for that
  // entity is loaded so we can resolve the entity name.
  const rehydratedRef = useRef(false)
  useEffect(() => {
    if (rehydratedRef.current) return
    if (initialUrl.drillEntityIds.length === 0) {
      rehydratedRef.current = true
      return
    }
    rehydratedRef.current = true
    void (async () => {
      const frames: DrillFrame[] = []
      let level: TrajectoryLevel = 'dimension'
      for (const entityId of initialUrl.drillEntityIds) {
        const r = await ensureLevel(level)
        const s = r.series.find((x) => x.entityId === entityId)
        if (!s) break
        frames.push({ level, entityId, entityName: s.entityName })
        const nextLevel: TrajectoryLevel | null = CHILD_OF_LEVEL[level]
        if (!nextLevel) break
        level = nextLevel
      }
      if (frames.length > 0) {
        await ensureLevel(level) // ensure children of deepest frame are loadable
        setDrillStack(frames)
      }
    })()
  }, [initialUrl.drillEntityIds, ensureLevel])

  const overviewResult = resultsByLevel.dimension ?? initialResult

  // Write state changes back to the URL. Preserves any unrelated query
  // params (e.g. `?id=` on the standalone trajectory page) by starting
  // from the current searchParams and only rewriting our own keys.
  useEffect(() => {
    const currentAssessmentIds = overviewResult.assessmentsTouched.map((a) => a.assessmentId)
    const allSelectedAgainstCurrent =
      selectedAssessmentIds.length === currentAssessmentIds.length &&
      currentAssessmentIds.every((id) => selectedAssessmentIds.includes(id))

    const trajectory = encodeTrajectoryParams({
      drillEntityIds: drillStack.map((f) => f.entityId),
      mode,
      matrix: showMatrix,
      assessmentIds: allSelectedAgainstCurrent ? null : selectedAssessmentIds,
    })

    const next = new URLSearchParams(searchParams.toString())
    for (const key of ['drill', 'mode', 'matrix', 'assessments']) next.delete(key)
    for (const [k, v] of trajectory) next.set(k, v)

    const nextQs = next.toString()
    const currentQs = searchParams.toString()
    if (nextQs === currentQs) return
    const url = nextQs.length > 0 ? `${pathname}?${nextQs}` : pathname
    router.replace(url, { scroll: false })
  }, [
    drillStack,
    mode,
    showMatrix,
    selectedAssessmentIds,
    overviewResult.assessmentsTouched,
    pathname,
    router,
    searchParams,
  ])

  const refetchOverview = () => {
    startTransition(async () => {
      const r = await getPersonTrajectory(campaignParticipantId, { level: 'dimension' })
      setResultsByLevel((prev) => ({ ...prev, dimension: r }))
    })
  }

  // Compare by set, not count — a refetch can reshape the assessment list
  // while length stays equal, which would silently leak deselected
  // assessments back into the view.
  const allAssessmentsSelected = useMemo(() => {
    if (selectedAssessmentIds.length !== overviewResult.assessmentsTouched.length) return false
    const sel = new Set(selectedAssessmentIds)
    return overviewResult.assessmentsTouched.every((a) => sel.has(a.assessmentId))
  }, [selectedAssessmentIds, overviewResult.assessmentsTouched])

  const filterSeries = useCallback(
    (input: TrajectorySeries[]): TrajectorySeries[] => {
      if (allAssessmentsSelected) return input
      return input
        .map((s) => ({
          ...s,
          points: s.points.filter((p) => selectedAssessmentIds.includes(p.assessmentId)),
        }))
        .filter((s) => s.points.length > 0)
    },
    [allAssessmentsSelected, selectedAssessmentIds],
  )

  const filteredOverviewSeries = useMemo<TrajectorySeries[]>(
    () => filterSeries(overviewResult.series),
    [overviewResult.series, filterSeries],
  )

  // Summary must reflect the visible data; recompute client-side when the
  // filter is narrowed so the editorial lede can't drift from the chart.
  const filteredSummary = useMemo(
    () =>
      allAssessmentsSelected
        ? overviewResult.summary
        : computeTrajectorySummary(filteredOverviewSeries),
    [allAssessmentsSelected, overviewResult.summary, filteredOverviewSeries],
  )

  const overviewSeriesById = useMemo(
    () => new Map(filteredOverviewSeries.map((s) => [s.entityId, s])),
    [filteredOverviewSeries],
  )

  // Drill rendering — same filter applies inside the drill, so share links
  // with assessments=... still narrow the focused entity and its children.
  const topFrame = drillStack[drillStack.length - 1] ?? null
  const focusedSeries: TrajectorySeries | null = useMemo(() => {
    if (!topFrame) return null
    const r = resultsByLevel[topFrame.level]
    if (!r) return null
    const raw = r.series.find((s) => s.entityId === topFrame.entityId) ?? null
    if (!raw) return null
    const [filtered] = filterSeries([raw])
    return filtered ?? null
  }, [resultsByLevel, topFrame, filterSeries])

  const childLevel = topFrame ? CHILD_OF_LEVEL[topFrame.level] : null
  const childSeries: TrajectorySeries[] = useMemo(() => {
    if (!topFrame || !childLevel) return []
    const r = resultsByLevel[childLevel]
    if (!r) return []
    const matched = r.series.filter(
      (s) =>
        s.parentId === topFrame.entityId ||
        (s.additionalParentIds ?? []).includes(topFrame.entityId),
    )
    return filterSeries(matched)
  }, [resultsByLevel, topFrame, childLevel, filterSeries])

  const childrenLoading = !!childLevel && !resultsByLevel[childLevel]

  // Push a drill frame, fetching the target level (and the child level for
  // its decomposition) if not cached.
  const drillInto = useCallback(
    (level: TrajectoryLevel, entityId: string, entityName: string) => {
      startTransition(async () => {
        await ensureLevel(level)
        const next = CHILD_OF_LEVEL[level]
        if (next) {
          // Fire-and-await for the child level too so the drill view renders
          // children without a perceptible second spinner.
          await ensureLevel(next)
        }
        setDrillStack((prev) => [...prev, { level, entityId, entityName }])
      })
    },
    [ensureLevel],
  )

  const popDrillTo = useCallback((depth: number) => {
    setDrillStack((prev) => prev.slice(0, depth))
  }, [])

  const onChildClick = useCallback(
    (childEntityId: string) => {
      if (!topFrame || !childLevel) return
      const r = resultsByLevel[childLevel]
      if (!r) return
      const s = r.series.find((x) => x.entityId === childEntityId)
      if (!s) return
      drillInto(childLevel, childEntityId, s.entityName)
    },
    [topFrame, childLevel, resultsByLevel, drillInto],
  )

  const onOverviewDrillClick = useCallback(
    (entityId: string) => {
      const s = overviewSeriesById.get(entityId)
      if (!s) return
      drillInto('dimension', entityId, s.entityName)
    },
    [overviewSeriesById, drillInto],
  )

  const hasMultipleSessions = filteredOverviewSeries.some((s) => s.points.length >= 2)
  const hasAnyData = filteredOverviewSeries.length > 0
  const isDrilled = drillStack.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TrajectoryPersonHeader
          result={overviewResult}
          onOpenLinkedRecords={() => setDrawerOpen(true)}
        />
        {hasAnyData && !isDrilled && (
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
        onAfterChange={refetchOverview}
      />

      {!hasAnyData ? (
        <EmptyState
          linkedCount={overviewResult.linkedParticipants.length}
          hasAnyTouched={overviewResult.assessmentsTouched.length > 0}
        />
      ) : isDrilled && focusedSeries ? (
        <TrajectoryDrillView
          stack={drillStack}
          focusedSeries={focusedSeries}
          childSeries={childSeries}
          childrenLoading={childrenLoading}
          mode={mode}
          onModeChange={setMode}
          onPopTo={popDrillTo}
          onChildClick={onChildClick}
        />
      ) : isDrilled && !focusedSeries ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          {pending ? 'Loading…' : 'That entity is no longer available at this level. Returning to overview.'}
          {!pending && (
            <button
              type="button"
              className="ml-2 underline underline-offset-2 text-foreground"
              onClick={() => popDrillTo(0)}
            >
              Go back
            </button>
          )}
        </div>
      ) : (
        <>
          <TrajectorySummaryPanel
            displayName={overviewResult.displayName}
            summary={filteredSummary}
          />

          {overviewResult.assessmentsTouched.length > 1 && (
            <AssessmentFilter
              assessments={overviewResult.assessmentsTouched}
              selectedIds={selectedAssessmentIds}
              onChange={setSelectedAssessmentIds}
            />
          )}

          {hasMultipleSessions ? (
            <TrajectoryTimeline
              series={filteredOverviewSeries}
              mode={mode}
              onModeChange={setMode}
              onSeriesClick={onOverviewDrillClick}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              Snapshot view — trajectory becomes meaningful with 2+ completed sessions per dimension.
            </div>
          )}

          <TrajectoryMoversStrip
            summary={filteredSummary}
            seriesById={overviewSeriesById}
            onSelect={onOverviewDrillClick}
          />

          {showMatrix && <TrajectoryMatrix series={filteredOverviewSeries} />}
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
