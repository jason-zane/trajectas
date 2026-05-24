'use client'

import { ChevronRight, ArrowLeft } from 'lucide-react'
import { TrajectoryTimeline, type TimelineMode } from './trajectory-timeline'
import { LocalTime } from '@/components/local-time'
import type { TrajectorySeries } from '@/lib/trajectory/types'

/**
 * Focused single-entity view. Replaces the overview workspace body when a
 * user drills into a dimension (today; factors and constructs as follow-up).
 * Shows:
 *  - Breadcrumb back to overview
 *  - Larger chart of just this entity
 *  - Source-sessions table with assessment, date, scaled, attempt
 */
export function TrajectoryDrillView({
  series,
  mode,
  onModeChange,
  onBack,
}: {
  series: TrajectorySeries
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  onBack: () => void
}) {
  const sortedPoints = [...series.points].sort((a, b) =>
    b.completedAt.localeCompare(a.completedAt),
  )

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="group inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        Back to overview
      </button>

      <div className="flex items-baseline gap-2 px-1">
        <p className="text-overline text-[var(--gold)]">Trajectory</p>
        <ChevronRight className="size-3.5 text-muted-foreground" />
        <h2 className="text-2xl font-bold tracking-tight">{series.entityName}</h2>
        {series.parentName && (
          <span className="text-caption text-muted-foreground">· {series.parentName}</span>
        )}
      </div>

      <TrajectoryTimeline
        series={[series]}
        mode={mode}
        onModeChange={onModeChange}
      />

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Source sessions</h3>
          <p className="text-caption text-muted-foreground">
            {series.points.length} {series.points.length === 1 ? 'session' : 'sessions'}
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
