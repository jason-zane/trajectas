'use client'

import { ChevronRight, ArrowLeft, CornerDownRight } from 'lucide-react'
import { TrajectoryTimeline, type TimelineMode } from './trajectory-timeline'
import { LocalTime } from '@/components/local-time'
import type { TrajectoryLevel, TrajectorySeries } from '@/lib/trajectory/types'

export type DrillFrame = {
  level: TrajectoryLevel
  entityId: string
  entityName: string
}

const CHILD_LEVEL_LABEL: Record<TrajectoryLevel, string> = {
  dimension: 'Dimensions',
  factor: 'Factors',
  construct: 'Constructs',
}

const CHILD_OF_LEVEL: Record<TrajectoryLevel, TrajectoryLevel | null> = {
  dimension: 'factor',
  factor: 'construct',
  construct: null,
}

/**
 * Focused single-entity view with optional child-level decomposition.
 * The breadcrumb runs across the top; the focused entity's chart is the
 * primary visual, with a smaller children-chart below (when the level
 * has children). Clicking a child line drills one level deeper. The
 * source-sessions table sits below the charts.
 */
export function TrajectoryDrillView({
  stack,
  focusedSeries,
  childSeries,
  childrenLoading,
  mode,
  onModeChange,
  onPopTo,
  onChildClick,
}: {
  stack: DrillFrame[]
  focusedSeries: TrajectorySeries
  /** Series at the child level filtered to children of the focused entity. */
  childSeries: TrajectorySeries[]
  childrenLoading: boolean
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  onPopTo: (depth: number) => void
  onChildClick: (childEntityId: string) => void
}) {
  const top = stack[stack.length - 1]
  const childLevel = CHILD_OF_LEVEL[top.level]

  const sortedPoints = [...focusedSeries.points].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  )

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => onPopTo(stack.length - 1)}
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Back to {stack.length === 1 ? 'overview' : stack[stack.length - 2].entityName}
      </button>

      <Breadcrumb stack={stack} onPopTo={onPopTo} />

      <TrajectoryTimeline
        series={[focusedSeries]}
        mode={mode}
        onModeChange={onModeChange}
        title={focusedSeries.entityName}
      />

      {childLevel && (
        <div className="space-y-2">
          {childrenLoading ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
              Loading {CHILD_LEVEL_LABEL[childLevel].toLowerCase()}…
            </div>
          ) : childSeries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
              No {CHILD_LEVEL_LABEL[childLevel].toLowerCase()} mapped under {focusedSeries.entityName} in the loaded sessions.
            </div>
          ) : (
            <TrajectoryTimeline
              series={childSeries}
              mode={mode}
              onModeChange={onModeChange}
              onSeriesClick={onChildClick}
              title={`Component ${CHILD_LEVEL_LABEL[childLevel].toLowerCase()}`}
              showModeToggle={false}
              heightPx={260}
            />
          )}
          {childSeries.length > 0 && (
            <p className="text-caption text-muted-foreground px-1 inline-flex items-center gap-1">
              <CornerDownRight className="size-3" />
              Click a line to drill into that {childLevel === 'factor' ? 'factor' : 'construct'}.
            </p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Source sessions</h3>
          <p className="text-caption text-muted-foreground">
            {focusedSeries.points.length} {focusedSeries.points.length === 1 ? 'session' : 'sessions'}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-caption text-muted-foreground border-b border-border">
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Assessment</th>
              <th className="px-4 py-2 font-medium">Campaign</th>
              <th className="px-4 py-2 font-medium text-right">Attempt</th>
              <th className="px-4 py-2 font-medium text-right">Scaled</th>
              <th className="px-4 py-2 font-medium text-right">Percentile</th>
            </tr>
          </thead>
          <tbody>
            {sortedPoints.map((p) => (
              <tr
                key={p.sessionId}
                className="border-b border-border last:border-0 hover:bg-cream/40 dark:hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-2.5 whitespace-nowrap">
                  <LocalTime iso={p.completedAt} format="date" />
                </td>
                <td className="px-4 py-2.5">{p.assessmentName}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{p.campaignTitle}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{p.attemptNumber}</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                  {p.scaledScore !== null ? Math.round(p.scaledScore) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                  {p.percentile !== null ? Math.round(p.percentile) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Breadcrumb({
  stack,
  onPopTo,
}: {
  stack: DrillFrame[]
  onPopTo: (depth: number) => void
}) {
  return (
    <nav aria-label="Trajectory breadcrumb" className="flex items-baseline flex-wrap gap-1.5 px-1">
      <button
        type="button"
        onClick={() => onPopTo(0)}
        className="text-overline text-[var(--gold)] hover:underline underline-offset-2"
      >
        Trajectory
      </button>
      {stack.map((f, i) => {
        const isLast = i === stack.length - 1
        return (
          <span key={f.entityId + ':' + i} className="inline-flex items-baseline gap-1.5">
            <ChevronRight className="size-3.5 text-muted-foreground self-center" />
            {isLast ? (
              <h2 className="text-2xl font-bold tracking-tight">{f.entityName}</h2>
            ) : (
              <button
                type="button"
                onClick={() => onPopTo(i + 1)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {f.entityName}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}
