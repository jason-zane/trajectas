'use client'

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import type { TrajectorySeries } from '@/lib/trajectory/types'

/**
 * Hero timeline for the Trajectory workspace.
 *
 * One line per entity (typically dimensions). Real temporal x-axis,
 * end-of-line labels in each line's colour, hover guideline with a
 * ranked tooltip listing every entity's value at the hovered moment.
 *
 * Two modes:
 *   - 'absolute'  — y = scaledScore as-is, locked to 0–100 (POMP scale)
 *   - 'change'    — y = scaled − first, symmetric around 0
 *
 * SVG is rendered in a fixed viewBox; the wrapping div is full width
 * and hover coordinates are mapped from clientX via getBoundingClientRect.
 */

const VIEW_W = 1000
const VIEW_H = 540
const PADDING = { top: 18, right: 132, bottom: 32, left: 44 }
/**
 * Fraction of the inner plot width to leave empty at each x-axis edge.
 * Without this, the first and last session dots sit flush against the
 * y-axis / right edge, which reads as visual crowding.
 */
const X_INSET_RATIO = 0.055
const INNER_W = VIEW_W - PADDING.left - PADDING.right
const INNER_H = VIEW_H - PADDING.top - PADDING.bottom

/**
 * Typical scoring range for POMP-scaled scores. Drawn as a subtle gold band
 * in absolute mode so middle-of-bell scores visually settle into an "expected"
 * zone. Echoes the 5Brains report's continuum-bar treatment. Ambient context
 * only — unlabelled.
 */
const TYPICAL_RANGE = { low: 30, high: 70 } as const

/**
 * Per-line colour. `text-*` so SVG can use `currentColor` for stroke/fill
 * and the end-label inherits the same hue automatically. Dark-mode tone
 * is slightly lighter to keep AA contrast against the card.
 */
const PALETTE: readonly string[] = [
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-sky-600 dark:text-sky-400',
  'text-rose-500 dark:text-rose-400',
  'text-violet-600 dark:text-violet-300',
  'text-teal-600 dark:text-teal-300',
  'text-fuchsia-600 dark:text-fuchsia-300',
  'text-orange-600 dark:text-orange-400',
]

export type TimelineMode = 'absolute' | 'change'

type PreparedSeries = {
  entityId: string
  entityName: string
  colourClass: string
  /** Indexed by sessionIndex, may contain nulls for sessions where this entity has no score. */
  values: (number | null)[]
  /** Smoothed display value at each session, used for rendering. */
  displayValues: (number | null)[]
  latestValue: number | null
  baselineValue: number | null
}

type SessionTick = {
  /** Composite key — uses ISO date + sessionId because two sessions can share a date. */
  key: string
  date: number
  /** All sessionIds at this tick (collapsed if same instant). */
  sessionIds: string[]
}

type ChartGeometry = {
  ticks: SessionTick[]
  prepared: PreparedSeries[]
  xForTick: (i: number) => number
  yScale: (v: number) => number
  yDomain: [number, number]
  yTicks: number[]
}

export function TrajectoryTimeline({
  series,
  mode,
  onModeChange,
  onSeriesClick,
  title = 'Trajectory',
  showModeToggle = true,
  heightPx = 540,
}: {
  series: TrajectorySeries[]
  mode: TimelineMode
  onModeChange: (m: TimelineMode) => void
  onSeriesClick?: (entityId: string) => void
  title?: string
  showModeToggle?: boolean
  heightPx?: number
}) {
  const geometry = useMemo(() => buildGeometry(series, mode), [series, mode])
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const gradientId = useId()

  const onMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const xPx = e.clientX - rect.left
      const xVb = (xPx / rect.width) * VIEW_W
      // Snap to nearest tick
      let best = 0
      let bestDist = Infinity
      geometry.ticks.forEach((_, i) => {
        const d = Math.abs(xVb - geometry.xForTick(i))
        if (d < bestDist) {
          bestDist = d
          best = i
        }
      })
      setHoverIdx(best)
    },
    [geometry],
  )

  const onMouseLeave = useCallback(() => setHoverIdx(null), [])

  if (geometry.ticks.length === 0 || geometry.prepared.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        No trajectory data to chart at this level.
      </div>
    )
  }

  const onlyOneTick = geometry.ticks.length === 1

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-4 pt-3">
        <p className="text-overline text-[var(--gold)]">{title}</p>
        {showModeToggle && (
          <ModeToggle
            mode={mode}
            onChange={onModeChange}
            disabled={onlyOneTick}
          />
        )}
      </div>

      {/*
        onMouseLeave lives on the wrapper, not the SVG itself, so moving
        the cursor from the chart into an overflowing tooltip doesn't drop
        hoverIdx (which would close the tooltip mid-scroll).
      */}
      <div className="relative" onMouseLeave={onMouseLeave}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} over time`}
          className="block w-full"
          style={{ height: `${heightPx}px` }}
          onMouseMove={onMouseMove}
        >
          <defs>
            {/* Soft top→bottom card wash so lines pop without competing */}
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--cream)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--cream)" stopOpacity="0" />
            </linearGradient>
          </defs>

          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={INNER_W}
            height={INNER_H}
            fill={`url(#${gradientId})`}
            className="dark:opacity-30"
          />

          {/* Typical-range band — absolute mode only; ambient gold wash 30–70 */}
          {mode === 'absolute' && (
            <rect
              x={PADDING.left}
              y={geometry.yScale(TYPICAL_RANGE.high)}
              width={INNER_W}
              height={geometry.yScale(TYPICAL_RANGE.low) - geometry.yScale(TYPICAL_RANGE.high)}
              fill="var(--gold)"
              opacity={0.09}
              className="dark:opacity-[0.14]"
            />
          )}

          <YAxis geometry={geometry} mode={mode} />
          <XAxis geometry={geometry} />

          {/* Zero line in change mode */}
          {mode === 'change' && (
            <line
              x1={PADDING.left}
              x2={VIEW_W - PADDING.right}
              y1={geometry.yScale(0)}
              y2={geometry.yScale(0)}
              className="stroke-border"
              strokeDasharray="3 4"
              strokeWidth={1}
            />
          )}

          {/* Lines + dots */}
          {geometry.prepared.map((p) => (
            <SeriesPath
              key={p.entityId}
              prepared={p}
              geometry={geometry}
              hoverIdx={hoverIdx}
              dimmed={activeId !== null && activeId !== p.entityId}
              active={activeId === p.entityId}
              onMouseEnter={() => setActiveId(p.entityId)}
              onMouseLeave={() => setActiveId(null)}
              onClick={onSeriesClick ? () => onSeriesClick(p.entityId) : undefined}
            />
          ))}

          {/* End-of-line labels */}
          <EndLabels
            geometry={geometry}
            activeId={activeId}
            onHoverSeries={setActiveId}
            onClickSeries={onSeriesClick}
          />

          {/* Hover guideline */}
          {hoverIdx !== null && (
            <line
              x1={geometry.xForTick(hoverIdx)}
              x2={geometry.xForTick(hoverIdx)}
              y1={PADDING.top}
              y2={VIEW_H - PADDING.bottom}
              className="stroke-foreground/30"
              strokeWidth={1}
              strokeDasharray="2 3"
              pointerEvents="none"
            />
          )}
        </svg>

        {/*
          When a series is being highlighted (line or end-label hover),
          its own per-session tooltip takes precedence over the
          all-dims-at-this-tick tooltip — the user is asking about ONE
          line, not "what was happening at this moment".
        */}
        {activeId !== null ? (
          <SeriesTooltip geometry={geometry} entityId={activeId} mode={mode} />
        ) : hoverIdx !== null ? (
          <HoverTooltip geometry={geometry} tickIndex={hoverIdx} mode={mode} />
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function buildGeometry(series: TrajectorySeries[], mode: TimelineMode): ChartGeometry {
  // 1. Collect unique completion timestamps across all series.
  //    Same instant from different sessions collapses to one tick.
  const ticksByInstant = new Map<number, SessionTick>()
  for (const s of series) {
    for (const p of s.points) {
      const t = Date.parse(p.completedAt)
      if (!Number.isFinite(t)) continue
      const existing = ticksByInstant.get(t)
      if (existing) {
        existing.sessionIds.push(p.sessionId)
      } else {
        ticksByInstant.set(t, {
          key: `${p.completedAt}:${p.sessionId}`,
          date: t,
          sessionIds: [p.sessionId],
        })
      }
    }
  }
  const ticks = [...ticksByInstant.values()].sort((a, b) => a.date - b.date)

  // Map session_id → tick index for fast lookups
  const tickIndexBySession = new Map<string, number>()
  ticks.forEach((tick, i) => {
    for (const sid of tick.sessionIds) tickIndexBySession.set(sid, i)
  })

  // 2. X scale — ordinal. Sessions are equally spaced regardless of date
  // gap. A small inset on each end keeps the first/last dots off the axis
  // edges, which otherwise looks visually crowded.
  const inset = INNER_W * X_INSET_RATIO
  const usableW = INNER_W - inset * 2
  const xForTick = (i: number) => {
    if (ticks.length === 1) return PADDING.left + INNER_W / 2
    return PADDING.left + inset + (i / (ticks.length - 1)) * usableW
  }

  // 3. Per-series value array aligned to ticks
  const prepared: PreparedSeries[] = series.map((s, idx) => {
    const values: (number | null)[] = new Array(ticks.length).fill(null)
    for (const p of s.points) {
      const i = tickIndexBySession.get(p.sessionId)
      if (i === undefined) continue
      values[i] = p.scaledScore
    }
    // Baseline = first non-null value
    let baselineValue: number | null = null
    for (const v of values) {
      if (v !== null) {
        baselineValue = v
        break
      }
    }
    const displayValues =
      mode === 'change' && baselineValue !== null
        ? values.map((v) => (v === null ? null : v - (baselineValue as number)))
        : values

    // Latest = last non-null display value
    let latestValue: number | null = null
    for (let i = displayValues.length - 1; i >= 0; i--) {
      const v = displayValues[i]
      if (v !== null) {
        latestValue = v
        break
      }
    }

    return {
      entityId: s.entityId,
      entityName: s.entityName,
      colourClass: PALETTE[idx % PALETTE.length],
      values,
      displayValues,
      latestValue,
      baselineValue,
    }
  })

  // 4. Y scale
  const allValues: number[] = []
  for (const p of prepared) {
    for (const v of p.displayValues) {
      if (v !== null && Number.isFinite(v)) allValues.push(v)
    }
  }

  let yDomain: [number, number]
  if (mode === 'absolute') {
    // Locked to the full POMP scale. Auto-tightening hid where scores sat
    // relative to "high" vs "low" and made the typical-range band useless.
    yDomain = [0, 100]
  } else {
    // Symmetric around 0
    const max = allValues.length ? Math.max(...allValues.map(Math.abs)) : 1
    const padded = Math.max(5, Math.ceil((max + 2) / 5) * 5)
    yDomain = [-padded, padded]
  }

  const yScale = (v: number) => {
    const [lo, hi] = yDomain
    const span = Math.max(1e-6, hi - lo)
    return PADDING.top + INNER_H - ((v - lo) / span) * INNER_H
  }

  // Y axis tick marks — finer ticks in absolute mode (every 10, full POMP
  // scale) so the range reads more legibly; symmetric 5-tick scheme in
  // change mode where the data is centered.
  const yTicks: number[] = []
  if (mode === 'absolute') {
    for (let v = 0; v <= 100; v += 10) yTicks.push(v)
  } else {
    for (let i = 0; i <= 4; i++) {
      yTicks.push(yDomain[0] + ((yDomain[1] - yDomain[0]) * i) / 4)
    }
  }

  return { ticks, prepared, xForTick, yScale, yDomain, yTicks }
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ModeToggle({
  mode,
  onChange,
  disabled,
}: {
  mode: TimelineMode
  onChange: (m: TimelineMode) => void
  disabled?: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label="Timeline mode"
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted/40 p-0.5 text-[11px] font-medium',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      {(['absolute', 'change'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="tab"
          aria-selected={mode === m}
          onClick={() => onChange(m)}
          className={cn(
            'rounded-full px-3 py-1 transition-colors',
            mode === m
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m === 'absolute' ? 'Absolute' : 'Change from first'}
        </button>
      ))}
    </div>
  )
}

function SeriesPath({
  prepared,
  geometry,
  hoverIdx,
  dimmed,
  active,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: {
  prepared: PreparedSeries
  geometry: ChartGeometry
  hoverIdx: number | null
  dimmed: boolean
  active: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick?: () => void
}) {
  // Build one polyline through every non-null point for this series.
  // Different sessions score different subsets of dimensions, so nulls
  // are the norm at ticks where this dimension wasn't measured — we
  // bridge them visually so the dimension's arc reads as one trajectory.
  // A series with <2 non-null points renders only as a dot (no segment).
  const linePoints: string[] = []
  for (let i = 0; i < prepared.displayValues.length; i++) {
    const v = prepared.displayValues[i]
    if (v === null) continue
    linePoints.push(`${geometry.xForTick(i).toFixed(2)},${geometry.yScale(v).toFixed(2)}`)
  }
  // SVG <polyline> expects space-separated coord pairs ("x1,y1 x2,y2 …"). An
  // earlier revision joined with " L " — SVG <path> lineTo command syntax —
  // which polyline silently ignores, so dots were rendered without lines.
  const segments: string[] = linePoints.length >= 2 ? [linePoints.join(' ')] : []

  return (
    <g
      className={cn(
        prepared.colourClass,
        'transition-opacity duration-200 cursor-pointer',
        dimmed ? 'opacity-25' : 'opacity-100',
      )}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
    >
      {/* Generous invisible hit area */}
      {segments.map((seg, i) => (
        <polyline
          key={`hit-${i}`}
          points={seg}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* Visible line */}
      {segments.map((seg, i) => (
        <polyline
          key={`line-${i}`}
          points={seg}
          fill="none"
          stroke="currentColor"
          strokeWidth={active ? 2.5 : 1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {/* Dots */}
      {prepared.displayValues.map((v, i) => {
        if (v === null) return null
        const isHovered = hoverIdx === i
        return (
          <circle
            key={`dot-${i}`}
            cx={geometry.xForTick(i)}
            cy={geometry.yScale(v)}
            r={isHovered ? 4.5 : active ? 3.5 : 2.75}
            fill="currentColor"
            className="stroke-card transition-all"
            strokeWidth={1.5}
          />
        )
      })}
    </g>
  )
}

function EndLabels({
  geometry,
  activeId,
  onHoverSeries,
  onClickSeries,
}: {
  geometry: ChartGeometry
  activeId: string | null
  onHoverSeries: (id: string | null) => void
  onClickSeries?: (id: string) => void
}) {
  // Build candidate label positions, then resolve vertical overlaps with a
  // simple greedy nudge from top to bottom.
  const lastIdx = geometry.ticks.length - 1
  const xLabel = geometry.xForTick(lastIdx) + 8

  const items = geometry.prepared
    .filter((p) => p.latestValue !== null)
    .map((p) => ({
      entityId: p.entityId,
      entityName: p.entityName,
      colourClass: p.colourClass,
      value: p.latestValue as number,
      y: geometry.yScale(p.latestValue as number),
    }))
    .sort((a, b) => a.y - b.y)

  // Resolve overlaps — minimum 14px spacing
  const minGap = 14
  for (let i = 1; i < items.length; i++) {
    if (items[i].y < items[i - 1].y + minGap) {
      items[i].y = items[i - 1].y + minGap
    }
  }
  // Clamp within chart bounds
  const yMax = VIEW_H - PADDING.bottom
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].y > yMax) items[i].y = yMax
    if (i < items.length - 1 && items[i].y > items[i + 1].y - minGap) {
      items[i].y = items[i + 1].y - minGap
    }
  }

  return (
    <g>
      {items.map((item) => {
        const dimmed = activeId !== null && activeId !== item.entityId
        return (
          <text
            key={item.entityId}
            x={xLabel}
            y={item.y + 3.5}
            onMouseEnter={() => onHoverSeries(item.entityId)}
            onMouseLeave={() => onHoverSeries(null)}
            onClick={onClickSeries ? () => onClickSeries(item.entityId) : undefined}
            className={cn(
              item.colourClass,
              'text-[10px] font-medium transition-opacity duration-200 cursor-pointer',
              dimmed ? 'opacity-20' : 'opacity-100',
            )}
            fill="currentColor"
          >
            {truncate(item.entityName, 16)}
            <tspan className="fill-muted-foreground tabular-nums" dx={4}>
              {formatValue(item.value)}
            </tspan>
          </text>
        )
      })}
    </g>
  )
}

function XAxis({ geometry }: { geometry: ChartGeometry }) {
  // Show date labels at first, last, and ~every nth in between to avoid clutter.
  // Then drop any whose position is within minLabelGap of an already-shown
  // label, so close-together sessions don't render labels on top of each other.
  const n = geometry.ticks.length
  const stride = n <= 6 ? 1 : Math.ceil(n / 5)
  const candidates = new Set<number>([0, n - 1])
  for (let i = stride; i < n - 1; i += stride) candidates.add(i)

  // Pick a format that fits the actual span — for tight ranges show day+month
  // so e.g. May 24, May 25, May 26 don't all collapse to "May 26".
  const spanDays =
    n >= 2
      ? (geometry.ticks[n - 1].date - geometry.ticks[0].date) / (1000 * 60 * 60 * 24)
      : 0
  const format = spanDays < 60 ? formatDateDayMonth : formatDateShort

  // Resolve overlaps: walk left-to-right, drop labels closer than this gap
  // (in viewBox units) to the previously-kept label.
  const minLabelGap = 60
  const shownIndices: number[] = []
  let lastShownX = -Infinity
  for (let i = 0; i < n; i++) {
    if (!candidates.has(i)) continue
    const x = geometry.xForTick(i)
    // Always keep the first and last; for middle ones, enforce gap
    const isEdge = i === 0 || i === n - 1
    if (isEdge || x - lastShownX >= minLabelGap) {
      shownIndices.push(i)
      lastShownX = x
    }
  }
  // Edge case: if first and last are too close (very short total span), drop the first
  if (shownIndices.length === 2 && shownIndices[1] - shownIndices[0] >= 1) {
    const x0 = geometry.xForTick(shownIndices[0])
    const x1 = geometry.xForTick(shownIndices[1])
    if (x1 - x0 < minLabelGap) shownIndices.shift()
  }
  const showAt = new Set<number>(shownIndices)

  return (
    <g>
      {/* Visible horizontal x-axis baseline */}
      <line
        x1={PADDING.left}
        x2={VIEW_W - PADDING.right}
        y1={VIEW_H - PADDING.bottom}
        y2={VIEW_H - PADDING.bottom}
        className="stroke-border"
        strokeWidth={1}
      />
      {geometry.ticks.map((tick, i) => {
        const x = geometry.xForTick(i)
        const isAnchor = showAt.has(i)
        return (
          <g key={tick.key}>
            <line
              x1={x}
              x2={x}
              y1={VIEW_H - PADDING.bottom}
              y2={VIEW_H - PADDING.bottom + 4}
              className="stroke-border"
              strokeWidth={1}
            />
            {isAnchor && (
              <text
                x={x}
                y={VIEW_H - PADDING.bottom + 18}
                textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {format(new Date(tick.date))}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function YAxis({ geometry, mode }: { geometry: ChartGeometry; mode: TimelineMode }) {
  const innerHeight = VIEW_H - PADDING.top - PADDING.bottom
  return (
    <g>
      {/* Visible vertical y-axis line on the left edge */}
      <line
        x1={PADDING.left}
        x2={PADDING.left}
        y1={PADDING.top}
        y2={PADDING.top + innerHeight}
        className="stroke-border"
        strokeWidth={1}
      />
      {geometry.yTicks.map((v, i) => {
        const y = geometry.yScale(v)
        return (
          <g key={i}>
            <line
              x1={PADDING.left}
              x2={VIEW_W - PADDING.right}
              y1={y}
              y2={y}
              className={i === 0 || i === geometry.yTicks.length - 1 ? 'stroke-border' : 'stroke-border/40'}
              strokeWidth={1}
            />
            <text
              x={PADDING.left - 6}
              y={y + 3.5}
              textAnchor="end"
              className="fill-muted-foreground text-[10px] tabular-nums"
            >
              {mode === 'change' && v > 0 ? `+${formatTick(v)}` : formatTick(v)}
            </text>
          </g>
        )
      })}
    </g>
  )
}

function HoverTooltip({
  geometry,
  tickIndex,
  mode,
}: {
  geometry: ChartGeometry
  tickIndex: number
  mode: TimelineMode
}) {
  const tick = geometry.ticks[tickIndex]
  const xVb = geometry.xForTick(tickIndex)
  // Position tooltip on whichever side has more room
  const onLeft = xVb / VIEW_W > 0.6
  const leftPct = onLeft ? undefined : ((xVb + 8) / VIEW_W) * 100
  const rightPct = onLeft ? ((VIEW_W - xVb + 8) / VIEW_W) * 100 : undefined

  const rows = geometry.prepared
    .map((p) => ({
      entityId: p.entityId,
      entityName: p.entityName,
      colourClass: p.colourClass,
      value: p.displayValues[tickIndex],
    }))
    .filter((r) => r.value !== null)
    .sort((a, b) => (b.value as number) - (a.value as number))

  if (rows.length === 0) return null

  return (
    <div
      className="absolute z-10 max-w-[240px] max-h-[88%] overflow-y-auto rounded-lg border border-border bg-popover/95 backdrop-blur-sm shadow-lg p-2.5"
      style={{
        top: '8px',
        left: leftPct !== undefined ? `${leftPct}%` : undefined,
        right: rightPct !== undefined ? `${rightPct}%` : undefined,
      }}
    >
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5 sticky top-0 bg-popover/95 backdrop-blur-sm pb-1 -mt-0.5">
        {formatDateLong(new Date(tick.date))}
      </p>
      <div className="space-y-0.5">
        {rows.map((r) => (
          <div key={r.entityId} className="flex items-center gap-2 text-[11px]">
            <span className={cn('inline-block size-2 rounded-full', r.colourClass)} style={{ backgroundColor: 'currentColor' }} />
            <span className="flex-1 truncate text-foreground">{r.entityName}</span>
            <span className="tabular-nums font-medium">
              {mode === 'change' && (r.value as number) > 0 ? '+' : ''}
              {formatValue(r.value as number)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Per-series tooltip shown when a single line is being highlighted (via line
 * or end-label hover). Lists that series' value at each session — the user's
 * mental question is "how has THIS thing moved over time", not "what was
 * happening across everything at one moment".
 *
 * Pinned to the top-left of the chart so it doesn't clash with the mode
 * toggle in the top-right; max-height + overflow-y keeps it from overflowing
 * the chart bounds even with many sessions.
 */
function SeriesTooltip({
  geometry,
  entityId,
  mode,
}: {
  geometry: ChartGeometry
  entityId: string
  mode: TimelineMode
}) {
  const prepared = geometry.prepared.find((p) => p.entityId === entityId)
  if (!prepared) return null
  return (
    <div
      className={cn(
        prepared.colourClass,
        'absolute z-10 top-2 left-2 max-w-[280px] max-h-[88%] overflow-y-auto',
        'rounded-lg border border-border bg-popover/95 backdrop-blur-sm shadow-lg p-2.5',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-popover/95 backdrop-blur-sm pb-1 -mt-0.5">
        <span
          aria-hidden
          className="inline-block size-2 rounded-full"
          style={{ backgroundColor: 'currentColor' }}
        />
        <p className="text-sm font-semibold leading-tight truncate text-foreground" title={prepared.entityName}>
          {prepared.entityName}
        </p>
      </div>
      <ul className="space-y-1">
        {geometry.ticks.map((tick, i) => {
          const v = prepared.displayValues[i]
          return (
            <li
              key={tick.key}
              className="flex items-center justify-between gap-3 text-[11px]"
            >
              <span className="text-muted-foreground tabular-nums">
                S{i + 1} · {formatDateDayMonth(new Date(tick.date))}
              </span>
              <span className="tabular-nums font-medium text-foreground">
                {v === null
                  ? '—'
                  : (mode === 'change' && v > 0 ? '+' : '') + formatValue(v)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

// Scaled scores are shown as whole numbers throughout — sub-point precision
// is noise from a measurement standpoint and makes the chart feel cluttered.
function formatTick(v: number): string {
  return String(Math.round(v))
}

function formatValue(v: number): string {
  return String(Math.round(v))
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

function formatDateDayMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatDateLong(d: Date): string {
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}
