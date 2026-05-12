'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { deltaMagnitude } from '@/lib/trajectory/rollup'
import type { TrajectoryPoint, TrajectorySeries } from '@/lib/trajectory/types'

/**
 * Tiny SVG line chart for one entity's trajectory. Small-multiples-friendly:
 * the layout is fixed-aspect and self-contained, so a grid of these renders
 * cleanly. We deliberately do NOT depend on a charting library — the chart
 * is intentionally small and bespoke.
 *
 * Y axis range is computed from the points themselves with a 10% padding.
 * Null points break the line.
 *
 * Each point's colour comes from the magnitude of the delta vs its prior
 * point (deltaMagnitude in rollup.ts). NOT a psychometric signal — see spec.
 */

const WIDTH = 280
const HEIGHT = 140
const PADDING = { top: 12, right: 14, bottom: 22, left: 32 }

const MAG_COLOR: Record<'none' | 'small' | 'medium' | 'large', string> = {
  none: 'fill-muted-foreground',
  small: 'fill-amber-500',
  medium: 'fill-blue-500',
  large: 'fill-violet-500',
}

type PreparedPoint = TrajectoryPoint & {
  cx: number | null
  cy: number | null
  prevScaled: number | null
}

function preparePoints(
  points: TrajectoryPoint[],
  yMin: number,
  yMax: number,
): PreparedPoint[] {
  const innerW = WIDTH - PADDING.left - PADDING.right
  const innerH = HEIGHT - PADDING.top - PADDING.bottom
  const span = Math.max(1, yMax - yMin)
  const n = points.length
  return points.map((p, i) => {
    const cx = n === 1 ? PADDING.left + innerW / 2 : PADDING.left + (i * innerW) / (n - 1)
    const cy =
      p.scaledScore === null
        ? null
        : PADDING.top + innerH - ((p.scaledScore - yMin) / span) * innerH
    return {
      ...p,
      cx,
      cy,
      prevScaled: i === 0 ? null : points[i - 1].scaledScore,
    }
  })
}

export function TrajectoryChart({
  series,
  highlighted = false,
}: {
  series: TrajectorySeries
  highlighted?: boolean
}) {
  const { yMin, yMax, prepared } = useMemo(() => {
    const ys = series.points
      .map((p) => p.scaledScore)
      .filter((v): v is number => v !== null && Number.isFinite(v))
    if (ys.length === 0) {
      return { yMin: 0, yMax: 100, prepared: preparePoints(series.points, 0, 100) }
    }
    const min = Math.min(...ys)
    const max = Math.max(...ys)
    const pad = Math.max(2, (max - min) * 0.15)
    const yMin = Math.max(0, Math.floor(min - pad))
    const yMax = Math.min(100, Math.ceil(max + pad))
    return {
      yMin,
      yMax: yMax === yMin ? yMin + 1 : yMax,
      prepared: preparePoints(series.points, yMin, yMax === yMin ? yMin + 1 : yMax),
    }
  }, [series.points])

  // Build polyline path, breaking on nulls
  const segments: string[] = []
  let currentSegment: string[] = []
  for (const p of prepared) {
    if (p.cy === null || p.cx === null) {
      if (currentSegment.length > 0) {
        segments.push(currentSegment.join(' L '))
        currentSegment = []
      }
      continue
    }
    currentSegment.push(`${p.cx},${p.cy}`)
  }
  if (currentSegment.length > 0) segments.push(currentSegment.join(' L '))

  const firstDate = series.points[0]?.completedAt
  const lastDate = series.points[series.points.length - 1]?.completedAt

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${series.entityName} trajectory`}
      className={cn(
        'block w-full h-auto rounded-md border bg-card transition-shadow',
        highlighted ? 'border-primary shadow-md' : 'border-border',
      )}
    >
      {/* Y axis labels (min and max only) */}
      <text
        x={PADDING.left - 6}
        y={PADDING.top + 4}
        textAnchor="end"
        className="fill-muted-foreground text-[9px] tabular-nums"
      >
        {yMax}
      </text>
      <text
        x={PADDING.left - 6}
        y={HEIGHT - PADDING.bottom}
        textAnchor="end"
        className="fill-muted-foreground text-[9px] tabular-nums"
      >
        {yMin}
      </text>

      {/* Baseline + frame */}
      <line
        x1={PADDING.left}
        y1={HEIGHT - PADDING.bottom}
        x2={WIDTH - PADDING.right}
        y2={HEIGHT - PADDING.bottom}
        className="stroke-border"
        strokeWidth={1}
      />
      <line
        x1={PADDING.left}
        y1={PADDING.top}
        x2={PADDING.left}
        y2={HEIGHT - PADDING.bottom}
        className="stroke-border"
        strokeWidth={1}
      />

      {/* Line segments (broken on null) */}
      {segments.map((seg, idx) => (
        <polyline
          key={idx}
          points={seg}
          fill="none"
          className="stroke-primary"
          strokeWidth={1.5}
        />
      ))}

      {/* Points */}
      {prepared.map((p) => {
        if (p.cx === null || p.cy === null) return null
        const mag = deltaMagnitude(
          p.prevScaled !== null && p.scaledScore !== null ? p.scaledScore - p.prevScaled : null,
        )
        return (
          <g key={p.sessionId}>
            <circle
              cx={p.cx}
              cy={p.cy}
              r={3.5}
              className={cn(MAG_COLOR[mag], 'stroke-card')}
              strokeWidth={1.5}
            >
              <title>
                {p.assessmentName} · attempt {p.attemptNumber}
                {'\n'}
                {new Date(p.completedAt).toLocaleDateString()}
                {'\n'}
                Scaled: {p.scaledScore ?? '—'}
                {p.percentile !== null ? `\nPercentile: ${p.percentile}` : ''}
              </title>
            </circle>
          </g>
        )
      })}

      {/* Date range labels */}
      {firstDate && (
        <text
          x={PADDING.left}
          y={HEIGHT - 4}
          textAnchor="start"
          className="fill-muted-foreground text-[9px]"
        >
          {new Date(firstDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
        </text>
      )}
      {lastDate && lastDate !== firstDate && (
        <text
          x={WIDTH - PADDING.right}
          y={HEIGHT - 4}
          textAnchor="end"
          className="fill-muted-foreground text-[9px]"
        >
          {new Date(lastDate).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
        </text>
      )}
    </svg>
  )
}
