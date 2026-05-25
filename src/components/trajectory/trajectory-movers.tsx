'use client'

import { cn } from '@/lib/utils'
import { STABLE_THRESHOLD } from '@/lib/trajectory/rollup'
import type {
  TrajectoryMover,
  TrajectorySeries,
  TrajectorySummary,
} from '@/lib/trajectory/types'

/**
 * Ranked "biggest movers" list rendered beneath the hero chart.
 *
 * Every dimension is shown — sorted by |Δ| descending — so the eye reads
 * magnitude top-to-bottom. A hatched ±STABLE_THRESHOLD band sits behind
 * every magnitude bar so deltas inside the noise floor are visually
 * distinguishable from real movement. Stable dimensions sit below a
 * "Within noise" rule and fade until hovered.
 *
 * The biggest mover row gets a soft gold-tinted wash and a one-line
 * editorial subtitle. Click any row to drill into that dimension.
 */
export function TrajectoryMoversStrip({
  summary,
  seriesById,
  onSelect,
}: {
  summary: TrajectorySummary
  seriesById: Map<string, TrajectorySeries>
  onSelect: (entityId: string) => void
}) {
  if (summary.topMovers.length === 0 && summary.stable.length === 0) return null

  // Bar scale: the biggest mover extends ~45% of half-width so the delta
  // label sits beyond without crowding. Floor on STABLE_THRESHOLD * 2 so the
  // noise band still reads when every delta is small.
  const maxAbsDelta = Math.max(
    ...summary.topMovers.map((m) => Math.abs(m.deltaScaled ?? 0)),
    ...summary.stable.map((m) => Math.abs(m.deltaScaled ?? 0)),
    STABLE_THRESHOLD * 2,
  )
  const barScale = 45 / maxAbsDelta
  const noiseHalfPct = STABLE_THRESHOLD * barScale

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-3 border-b border-border">
        <p className="text-overline text-[var(--gold)]">Biggest movers</p>
        <p className="text-caption text-muted-foreground">
          Ranked by |Δ| · grey band marks ±{STABLE_THRESHOLD} noise floor · click a row to drill in
        </p>
      </header>

      <ul>
        {summary.topMovers.map((m, i) => (
          <MoverRow
            key={m.entityId}
            mover={m}
            series={seriesById.get(m.entityId)}
            barScale={barScale}
            noiseHalfPct={noiseHalfPct}
            featured={i === 0}
            onSelect={onSelect}
          />
        ))}

        {summary.stable.length > 0 && (
          <NoiseDivider hasMovers={summary.topMovers.length > 0} />
        )}

        {summary.stable.map((m) => (
          <MoverRow
            key={m.entityId}
            mover={m}
            series={seriesById.get(m.entityId)}
            barScale={barScale}
            noiseHalfPct={noiseHalfPct}
            muted
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  )
}

function MoverRow({
  mover,
  series,
  barScale,
  noiseHalfPct,
  featured,
  muted,
  onSelect,
}: {
  mover: TrajectoryMover
  series: TrajectorySeries | undefined
  barScale: number
  noiseHalfPct: number
  featured?: boolean
  muted?: boolean
  onSelect: (entityId: string) => void
}) {
  const delta = mover.deltaScaled
  const positive = (delta ?? 0) >= 0
  const subtitle = featured ? editorialSubtitle(mover) : null

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(mover.entityId)}
        aria-label={describeMover(mover, { muted })}
        className={cn(
          'group relative w-full text-left',
          'grid items-center gap-x-4 gap-y-1',
          'grid-cols-[1.4fr_0.55fr_1.7fr_0.85fr]',
          'px-4 py-3.5 border-b border-border last:border-b-0',
          'transition-colors duration-200',
          'hover:bg-[var(--cream)] dark:hover:bg-muted/40',
          'focus:outline-none focus-visible:bg-[var(--cream)] dark:focus-visible:bg-muted/40',
          featured && 'bg-[linear-gradient(90deg,rgba(201,169,98,0.07),transparent_60%)]',
          muted && 'opacity-60 hover:opacity-100',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5 bg-[var(--gold)] origin-top scale-y-0 transition-transform duration-200 group-hover:scale-y-100"
        />

        <div className="flex items-center gap-2.5 min-w-0">
          <span
            aria-hidden
            className="inline-block size-2.5 rounded-full shrink-0 bg-foreground/70"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate" title={mover.entityName}>
              {mover.entityName}
            </p>
            {subtitle && (
              <p className="text-caption text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="text-right">
          <p className="text-xl font-bold tabular-nums leading-none">
            {mover.latestScaled !== null ? Math.round(mover.latestScaled) : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            Latest
          </p>
        </div>

        <MagnitudeBar
          delta={delta}
          barScale={barScale}
          noiseHalfPct={noiseHalfPct}
          positive={positive}
        />

        <Sparkline
          points={series?.points.map((p) => p.scaledScore) ?? []}
          positive={positive}
          muted={muted}
        />
      </button>
    </li>
  )
}

function MagnitudeBar({
  delta,
  barScale,
  noiseHalfPct,
  positive,
}: {
  delta: number | null
  barScale: number
  noiseHalfPct: number
  positive: boolean
}) {
  if (delta === null) {
    return <div className="h-6" aria-hidden />
  }
  const widthPct = Math.min(48, Math.abs(delta) * barScale)
  const labelOffsetPct = widthPct + 1

  return (
    <div className="relative h-6 flex items-center" aria-hidden>
      <span
        className="absolute top-1/2 -translate-y-1/2 h-4 rounded-sm pointer-events-none"
        style={{
          left: `calc(50% - ${noiseHalfPct}%)`,
          width: `${noiseHalfPct * 2}%`,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(107,107,107,0.07) 0 3px, transparent 3px 6px)',
        }}
      />
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <span
        className={cn(
          'absolute top-1/2 -translate-y-1/2 h-2 rounded-full',
          positive
            ? 'bg-emerald-600 dark:bg-emerald-500'
            : 'bg-rose-500 dark:bg-rose-400',
        )}
        style={
          positive
            ? { left: '50%', width: `${widthPct}%` }
            : { right: '50%', width: `${widthPct}%` }
        }
      />
      <span
        className={cn(
          'absolute top-1/2 -translate-y-1/2 text-xs font-bold tabular-nums whitespace-nowrap',
          positive
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-rose-700 dark:text-rose-300',
        )}
        style={
          positive
            ? { left: `calc(50% + ${labelOffsetPct}%)` }
            : { right: `calc(50% + ${labelOffsetPct}%)` }
        }
      >
        {formatDelta(delta)}
      </span>
    </div>
  )
}

function NoiseDivider({ hasMovers }: { hasMovers: boolean }) {
  return (
    <li
      aria-hidden
      className={cn(
        'flex items-center gap-3 px-4 py-2 bg-[var(--cream)] dark:bg-muted/30',
        hasMovers ? 'border-y border-border' : 'border-b border-border',
      )}
    >
      <span className="flex-1 h-px bg-border" />
      <span className="text-[10px] tracking-[0.16em] uppercase font-mono text-muted-foreground">
        Within noise · |Δ| &lt; {STABLE_THRESHOLD}
      </span>
      <span className="flex-1 h-px bg-border" />
    </li>
  )
}

function Sparkline({
  points,
  positive,
  muted,
}: {
  points: (number | null)[]
  positive: boolean
  muted?: boolean
}) {
  const W = 88
  const H = 28
  const vals = points.filter((v): v is number => v !== null && Number.isFinite(v))
  if (vals.length === 0) {
    return <div className="h-7" aria-hidden />
  }

  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(1, max - min)
  const coords: string[] = []
  let idx = 0
  for (const v of points) {
    if (v === null) {
      idx++
      continue
    }
    const x = points.length === 1 ? W / 2 : (idx / (points.length - 1)) * W
    const y = H - ((v - min) / span) * H
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    idx++
  }

  const arrow = positive ? '▲' : '▼'
  const arrowColour =
    muted
      ? 'text-muted-foreground'
      : positive
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-500 dark:text-rose-400'
  const strokeColour =
    muted
      ? 'stroke-muted-foreground/70'
      : positive
        ? 'stroke-emerald-600 dark:stroke-emerald-400'
        : 'stroke-rose-500 dark:stroke-rose-400'

  return (
    <div className="flex items-center justify-end gap-2" aria-hidden>
      <span className={cn('text-xs font-bold w-3 text-center', arrowColour)}>{arrow}</span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        width={W}
        height={H}
        className="block"
      >
        {coords.length >= 2 ? (
          <polyline
            points={coords.join(' ')}
            fill="none"
            className={strokeColour}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <circle
            cx={coords[0]?.split(',')[0]}
            cy={coords[0]?.split(',')[1]}
            r={2}
            className={cn('fill-current', arrowColour)}
          />
        )}
      </svg>
    </div>
  )
}

/**
 * Screen-reader text for a row button. Every visual element inside the row
 * is aria-hidden (the magnitude bar, sparkline arrow, and delta number all
 * duplicate one another for sighted users), so this label has to carry the
 * full meaning: name, latest score, direction and size of change, and
 * noise-floor status.
 */
function describeMover(mover: TrajectoryMover, opts: { muted?: boolean }): string {
  const parts: string[] = [mover.entityName]
  if (mover.latestScaled !== null) {
    parts.push(`latest ${Math.round(mover.latestScaled)}`)
  }
  const v = mover.deltaScaled
  if (v !== null) {
    if (v === 0) {
      parts.push('unchanged from first session')
    } else {
      const rounded = Math.round(Math.abs(v) * 10) / 10
      const magnitude = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
      parts.push(`${v > 0 ? 'up' : 'down'} ${magnitude} from first session`)
    }
    if (opts.muted) parts.push('within noise')
  }
  parts.push('click to drill in')
  return parts.join(', ')
}

function formatDelta(v: number): string {
  const r = Math.round(v * 10) / 10
  const sign = r >= 0 ? '+' : ''
  return `${sign}${Number.isInteger(r) ? r : r.toFixed(1)}`
}

/**
 * One-line subtitle for the featured (biggest-mover) row. Terse — one
 * observation about the shape of the change, not a rephrasing of the number.
 */
function editorialSubtitle(mover: TrajectoryMover): string {
  const d = mover.deltaScaled
  if (d === null) return ''
  const abs = Math.abs(d)
  if (abs >= 15) return d > 0 ? 'Strongest sustained gain' : 'Steepest decline — worth a closer look'
  if (abs >= 8) return d > 0 ? 'Clear upward arc' : 'Trending down'
  return d > 0 ? 'Slight positive trend' : 'Drifting down slightly'
}
