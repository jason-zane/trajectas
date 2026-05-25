'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { getPersonTrajectory } from '@/app/actions/trajectory-data'
import { computeTrajectorySummary } from '@/lib/trajectory/rollup'
import { TrajectoryPersonHeader } from './trajectory-person-header'
import { TrajectorySummaryPanel } from './trajectory-summary'
import { TrajectoryTimeline, type TimelineMode } from './trajectory-timeline'
import { TrajectoryMoversStrip } from './trajectory-movers'
import { TrajectoryCapabilitiesList } from './trajectory-capabilities-list'
import { TrajectoryLevelToggle } from './trajectory-level-toggle'
import { TrajectoryDrillView, type DrillFrame } from './trajectory-drill-view'
import { TrajectoryLinkedRecordsDrawer } from './trajectory-linked-records-drawer'
import {
  decodeTrajectoryParams,
  encodeTrajectoryParams,
  type TrajectoryViewLevel,
} from '@/lib/trajectory/url-params'
import type {
  TrajectoryLevel,
  TrajectoryResult,
  TrajectorySeries,
} from '@/lib/trajectory/types'

/**
 * In the Capabilities view, plotting every factor as a line would be illegible
 * (an assessment can have 20+). We cap the chart to the N biggest movers by
 * |Δ| so the picture stays readable; the list below shows the full set.
 */
const CAPABILITIES_CHART_TOP_N = 8

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
  const [viewLevel, setViewLevel] = useState<TrajectoryViewLevel>(initialUrl.viewLevel)
  const [parentFilter, setParentFilter] = useState<string | null>(initialUrl.parentFilter)
  // null = use default for this view (all dims / top-N caps). A concrete set
  // means the user has explicitly composed a comparison and we honour it.
  const [selectedDimIds, setSelectedDimIds] = useState<Set<string> | null>(null)
  // Scoped to a parent context — switching parent filters invalidates the
  // previous selection (its ids may not even exist in the new child set).
  const [selectedCaps, setSelectedCaps] = useState<{
    parent: string | null
    ids: Set<string>
  } | null>(null)
  const [mode, setMode] = useState<TimelineMode>(initialUrl.mode)
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
      // Drill chain origin depends on the active top-level view: from the
      // Dimensions view the chain starts at dimension; from Capabilities the
      // chain starts at factor (capability drills push factor frames). Without
      // this, a shared link with both level=factor and drill=… would look up
      // a factor id in dimension series and lose the drill stack.
      let level: TrajectoryLevel =
        initialUrl.viewLevel === 'factor' ? 'factor' : 'dimension'
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
  }, [initialUrl.drillEntityIds, initialUrl.viewLevel, ensureLevel])

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
      viewLevel,
      parentFilter,
      selectedEntityIds: null,
      drillEntityIds: drillStack.map((f) => f.entityId),
      mode,
      matrix: false,
      assessmentIds: allSelectedAgainstCurrent ? null : selectedAssessmentIds,
    })

    const next = new URLSearchParams(searchParams.toString())
    for (const key of ['level', 'parent', 'selected', 'drill', 'mode', 'matrix', 'assessments']) {
      next.delete(key)
    }
    for (const [k, v] of trajectory) next.set(k, v)

    const nextQs = next.toString()
    const currentQs = searchParams.toString()
    if (nextQs === currentQs) return
    const url = nextQs.length > 0 ? `${pathname}?${nextQs}` : pathname
    router.replace(url, { scroll: false })
  }, [
    viewLevel,
    parentFilter,
    drillStack,
    mode,
    selectedAssessmentIds,
    overviewResult.assessmentsTouched,
    pathname,
    router,
    searchParams,
  ])

  // When the user flips to the Capabilities view, lazily fetch the factor-level
  // result if we don't have it cached yet. The dimension result was loaded
  // server-side; factor data only comes in on demand.
  useEffect(() => {
    if (viewLevel !== 'factor') return
    if (resultsByLevel.factor) return
    void (async () => {
      await ensureLevel('factor')
    })()
  }, [viewLevel, resultsByLevel.factor, ensureLevel])

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

  // ---------------------------------------------------------------------
  // Capabilities view derivations
  // ---------------------------------------------------------------------

  /** Factor-level series passed through the assessment filter. */
  const filteredFactorSeries = useMemo<TrajectorySeries[]>(() => {
    const r = resultsByLevel.factor
    if (!r) return []
    return filterSeries(r.series)
  }, [resultsByLevel.factor, filterSeries])

  const parentDimensionName = useMemo<string | null>(() => {
    if (!parentFilter) return null
    const dim = overviewResult.series.find((s) => s.entityId === parentFilter)
    return dim?.entityName ?? null
  }, [parentFilter, overviewResult.series])

  /**
   * A stored parentFilter is only honoured when it actually resolves to a
   * current dimension. Old shared links can carry a parent id that no longer
   * exists (taxonomy edits, deletions) — applying it would produce an empty
   * capabilities list with no in-view way to clear the filter, since the
   * clear chip only shows when the parent resolves. Flipping levels or
   * navigating away then back clears the stale value naturally.
   */
  const effectiveParentFilter = parentFilter && parentDimensionName ? parentFilter : null

  /**
   * Factor series to show in the Capabilities list. If a parent filter is
   * active and resolves, narrow to that dimension's children (including the
   * many-to-many additionalParentIds case). Otherwise return everything.
   */
  const capabilityListSeries = useMemo<TrajectorySeries[]>(() => {
    if (!effectiveParentFilter) return filteredFactorSeries
    return filteredFactorSeries.filter(
      (s) =>
        s.parentId === effectiveParentFilter ||
        (s.additionalParentIds ?? []).includes(effectiveParentFilter),
    )
  }, [filteredFactorSeries, effectiveParentFilter])

  // ---------------------------------------------------------------------
  // Selection — which series are currently plotted on the chart
  // ---------------------------------------------------------------------

  /**
   * Default selection in the Dimensions view: every dimension is on.
   * With only ~5 dimensions there's no readability cost to showing them all.
   */
  const defaultSelectedDimIds = useMemo(
    () => new Set(filteredOverviewSeries.map((s) => s.entityId)),
    [filteredOverviewSeries],
  )

  /**
   * Default selection in the Capabilities view depends on the parent filter:
   *  - parent filter active → all of that dimension's children (small set)
   *  - no filter → top-N movers by |Δ|, so the chart isn't a tangle of lines
   */
  const defaultSelectedCapIds = useMemo<Set<string>>(() => {
    if (capabilityListSeries.length === 0) return new Set()
    if (effectiveParentFilter) return new Set(capabilityListSeries.map((s) => s.entityId))
    const ranked = [...capabilityListSeries].sort(
      (a, b) => absDeltaScaled(b) - absDeltaScaled(a),
    )
    return new Set(ranked.slice(0, CAPABILITIES_CHART_TOP_N).map((s) => s.entityId))
  }, [capabilityListSeries, effectiveParentFilter])

  const effectiveSelectedDimIds = selectedDimIds ?? defaultSelectedDimIds
  // Honour the user's explicit selection only when it's scoped to the
  // current parent context. Switching brains drops to the default selection
  // for the new context automatically, with no effect needed.
  const effectiveSelectedCapIds: ReadonlySet<string> =
    selectedCaps && selectedCaps.parent === effectiveParentFilter
      ? selectedCaps.ids
      : defaultSelectedCapIds

  const dimensionsChartSeries = useMemo(
    () => filteredOverviewSeries.filter((s) => effectiveSelectedDimIds.has(s.entityId)),
    [filteredOverviewSeries, effectiveSelectedDimIds],
  )

  const capabilityChartSeries = useMemo(
    () => capabilityListSeries.filter((s) => effectiveSelectedCapIds.has(s.entityId)),
    [capabilityListSeries, effectiveSelectedCapIds],
  )

  const factorResultLoading = viewLevel === 'factor' && !resultsByLevel.factor

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

  /**
   * "Drill + flip" from a dimension row in the Dimensions view: switches to
   * the Capabilities view and pre-filters it to that dimension's children.
   * Cheaper than the drill stack — no separate breadcrumb, just a level flip
   * — and matches the way users naturally read the list ("Pink moved most —
   * show me what's inside Pink").
   */
  const onDimensionDrillFlip = useCallback(
    (dimensionId: string) => {
      startTransition(() => {
        setViewLevel('factor')
        setParentFilter(dimensionId)
      })
      void ensureLevel('factor')
    },
    [ensureLevel],
  )

  const onLevelChange = useCallback((next: TrajectoryViewLevel) => {
    setViewLevel(next)
    // Flipping away from Capabilities clears any active parent filter — the
    // filter only makes sense within the cap view.
    if (next !== 'factor') setParentFilter(null)
  }, [])

  // Toggle helpers — null means "use default", any other set means the user
  // has explicitly composed a comparison. Materialise the default once on
  // first toggle so the user is operating on a real Set going forward.
  const onToggleDim = useCallback(
    (entityId: string) => {
      setSelectedDimIds((prev) => {
        const base = new Set(prev ?? defaultSelectedDimIds)
        if (base.has(entityId)) base.delete(entityId)
        else base.add(entityId)
        return base
      })
    },
    [defaultSelectedDimIds],
  )

  const onToggleCap = useCallback(
    (entityId: string) => {
      setSelectedCaps((prev) => {
        const seed =
          prev && prev.parent === effectiveParentFilter ? prev.ids : defaultSelectedCapIds
        const next = new Set(seed)
        if (next.has(entityId)) next.delete(entityId)
        else next.add(entityId)
        return { parent: effectiveParentFilter, ids: next }
      })
    },
    [defaultSelectedCapIds, effectiveParentFilter],
  )

  const onSelectAllDims = useCallback(() => {
    setSelectedDimIds(new Set(filteredOverviewSeries.map((s) => s.entityId)))
  }, [filteredOverviewSeries])

  const onClearAllDims = useCallback(() => setSelectedDimIds(new Set()), [])

  const onSelectAllCaps = useCallback(() => {
    setSelectedCaps({
      parent: effectiveParentFilter,
      ids: new Set(capabilityListSeries.map((s) => s.entityId)),
    })
  }, [capabilityListSeries, effectiveParentFilter])

  const onClearAllCaps = useCallback(
    () => setSelectedCaps({ parent: effectiveParentFilter, ids: new Set() }),
    [effectiveParentFilter],
  )

  const hasMultipleSessions = filteredOverviewSeries.some((s) => s.points.length >= 2)
  const hasAnyData = filteredOverviewSeries.length > 0
  const isDrilled = drillStack.length > 0
  const dimensionCount = filteredOverviewSeries.length
  const capabilityCount = filteredFactorSeries.length

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <TrajectoryPersonHeader
          result={overviewResult}
          onOpenLinkedRecords={() => setDrawerOpen(true)}
        />
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

          <div className="flex flex-wrap items-center justify-between gap-3">
            <TrajectoryLevelToggle
              value={viewLevel}
              dimensionCount={dimensionCount}
              capabilityCount={capabilityCount}
              onChange={onLevelChange}
            />
          </div>

          {viewLevel === 'dimension' ? (
            <DimensionsView
              hasMultipleSessions={hasMultipleSessions}
              chartSeries={dimensionsChartSeries}
              summary={filteredSummary}
              seriesById={overviewSeriesById}
              selectedIds={effectiveSelectedDimIds}
              onToggle={onToggleDim}
              onSelectAll={onSelectAllDims}
              onClearAll={onClearAllDims}
              mode={mode}
              onModeChange={setMode}
              onDrillFlip={onDimensionDrillFlip}
            />
          ) : (
            <CapabilitiesView
              chartSeries={capabilityChartSeries}
              listSeries={capabilityListSeries}
              selectedIds={effectiveSelectedCapIds}
              onToggle={onToggleCap}
              onSelectAll={onSelectAllCaps}
              onClearAll={onClearAllCaps}
              mode={mode}
              onModeChange={setMode}
              loading={factorResultLoading}
              parentDimensionName={parentDimensionName}
              onClearParentFilter={() => setParentFilter(null)}
            />
          )}

        </>
      )}
    </div>
  )
}

function DimensionsView({
  hasMultipleSessions,
  chartSeries,
  summary,
  seriesById,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  mode,
  onModeChange,
  onDrillFlip,
}: {
  hasMultipleSessions: boolean
  chartSeries: TrajectorySeries[]
  summary: ReturnType<typeof computeTrajectorySummary>
  seriesById: Map<string, TrajectorySeries>
  selectedIds: ReadonlySet<string>
  onToggle: (entityId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  onDrillFlip: (dimensionId: string) => void
}) {
  const chartReady = hasMultipleSessions && chartSeries.length > 0
  return (
    <>
      {chartReady ? (
        <TrajectoryTimeline
          series={chartSeries}
          mode={mode}
          onModeChange={onModeChange}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {hasMultipleSessions
            ? 'No dimensions selected — tick a row to plot it on the chart.'
            : 'Snapshot view — trajectory becomes meaningful with 2+ completed sessions per dimension.'}
        </div>
      )}

      <TrajectoryMoversStrip
        summary={summary}
        seriesById={seriesById}
        selectedIds={selectedIds}
        onToggle={onToggle}
        onDrill={onDrillFlip}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
      />
    </>
  )
}

function CapabilitiesView({
  chartSeries,
  listSeries,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
  mode,
  onModeChange,
  loading,
  parentDimensionName,
  onClearParentFilter,
}: {
  chartSeries: TrajectorySeries[]
  listSeries: TrajectorySeries[]
  selectedIds: ReadonlySet<string>
  onToggle: (entityId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  loading: boolean
  parentDimensionName: string | null
  onClearParentFilter: () => void
}) {
  if (loading && listSeries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        Loading capabilities…
      </div>
    )
  }
  if (listSeries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
        No capability-level scores available for this person yet.
      </div>
    )
  }

  const chartReady = chartSeries.some((s) => s.points.length >= 2)

  return (
    <>
      {parentDimensionName && (
        <ParentBreadcrumb name={parentDimensionName} onBack={onClearParentFilter} />
      )}

      {chartReady ? (
        <TrajectoryTimeline
          series={chartSeries}
          mode={mode}
          onModeChange={onModeChange}
        />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          {selectedIds.size === 0
            ? 'No capabilities selected — tick rows to plot them.'
            : 'Snapshot view — trajectory becomes meaningful with 2+ completed sessions per capability.'}
        </div>
      )}

      <TrajectoryCapabilitiesList
        series={listSeries}
        selectedIds={selectedIds}
        onToggle={onToggle}
        onSelectAll={onSelectAll}
        onClearAll={onClearAll}
      />
    </>
  )
}

/**
 * Prominent header rendered above the Capabilities view when a parent
 * dimension filter is active. Says exactly which brain you're inside and
 * gives an obvious way back to the full list — the old subtle pill chip
 * was too easy to miss.
 */
function ParentBreadcrumb({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-[linear-gradient(90deg,rgba(201,169,98,0.08),transparent_60%)] px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-overline text-[var(--gold)]">Viewing inside</span>
        <span className="font-semibold text-base truncate" title={name}>{name}</span>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs hover:bg-muted transition-colors"
      >
        <span aria-hidden>←</span>
        Back to all capabilities
      </button>
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

function absDeltaScaled(s: TrajectorySeries): number {
  const points = s.points
  if (points.length < 2) return 0
  const first = points[0]?.scaledScore ?? null
  const last = points[points.length - 1]?.scaledScore ?? null
  if (first === null || last === null) return 0
  return Math.abs(last - first)
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
