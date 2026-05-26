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
 * every magnitude bar so deltas inside the noise floor read as noise.
 * Stable dimensions sit below a "Within noise" rule and fade until hovered.
 *
 * Row click toggles whether the dimension's line appears on the chart.
 * A small ↳ button on the right drills into that dimension's capabilities.
 */
export function TrajectoryMoversStrip({
  summary,
  seriesById,
  selectedIds,
  onToggle,
  onDrill,
  onSelectAll,
  onClearAll,
}: {
  summary: TrajectorySummary
  seriesById: Map<string, TrajectorySeries>
  /** Entities whose chart line is currently shown. */
  selectedIds: ReadonlySet<string>
  /** Toggle whether this entity's line shows on the chart. */
  onToggle: (entityId: string) => void
  /** Drill+flip into this entity's children. Optional — present for dimensions. */
  onDrill?: (entityId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  const totalRows = summary.topMovers.length + summary.stable.length
  if (totalRows === 0) return null

  const maxAbsDelta = Math.max(
    ...summary.topMovers.map((m) => Math.abs(m.deltaScaled ?? 0)),
    ...summary.stable.map((m) => Math.abs(m.deltaScaled ?? 0)),
    STABLE_THRESHOLD * 2,
  )
  const barScale = 45 / maxAbsDelta
  const noiseHalfPct = STABLE_THRESHOLD * barScale
  const selectedCount = selectedIds.size

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-3 border-b border-border">
        <div className="flex items-baseline gap-3">
          <p className="text-overline text-[var(--gold)]">Biggest movers</p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {selectedCount} of {totalRows} on chart
          </p>
        </div>
        <div className="flex items-center gap-3 text-caption text-muted-foreground">
          <span className="hidden sm:inline">
            Click to toggle · ↳ to drill in
          </span>
          <button
            type="button"
            onClick={selectedCount === totalRows ? onClearAll : onSelectAll}
            className="rounded-full border border-border px-2.5 py-0.5 text-[11px] hover:bg-muted transition-colors"
          >
            {selectedCount === totalRows ? 'Hide all' : 'Show all'}
          </button>
        </div>
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
            selected={selectedIds.has(m.entityId)}
            onToggle={onToggle}
            onDrill={onDrill}
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
            selected={selectedIds.has(m.entityId)}
            onToggle={onToggle}
            onDrill={onDrill}
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
  selected,
  onToggle,
  onDrill,
}: {
  mover: TrajectoryMover
  series: TrajectorySeries | undefined
  barScale: number
  noiseHalfPct: number
  featured?: boolean
  muted?: boolean
  selected: boolean
  onToggle: (entityId: string) => void
  onDrill?: (entityId: string) => void
}) {
  const delta = mover.deltaScaled
  const positive = (delta ?? 0) >= 0
  const subtitle = featured ? editorialSubtitle(mover) : null
  const dimmed = !selected
  // Grid columns: checkbox · name · latest · bar · spark · (drill chevron when present)
  const gridCols = onDrill
    ? 'grid-cols-[18px_1.3fr_0.55fr_1.7fr_0.85fr_22px]'
    : 'grid-cols-[18px_1.3fr_0.55fr_1.7fr_0.85fr]'

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(mover.entityId)}
        onKeyDown={(e) => {
          // Only react to keys pressed on the row itself, not bubbled from
          // nested controls like the ↳ drill button.
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(mover.entityId)
          }
        }}
        aria-pressed={selected}
        aria-label={describeMover(mover, { muted, selected })}
        className={cn(
          'group relative w-full text-left cursor-pointer',
          'grid items-center gap-x-4',
          gridCols,
          'px-4 py-3.5 border-b border-border last:border-b-0',
          'transition-colors duration-200',
          'hover:bg-[var(--cream)] dark:hover:bg-muted/40',
          'focus:outline-none focus-visible:bg-[var(--cream)] dark:focus-visible:bg-muted/40',
          featured && selected && 'bg-[linear-gradient(90deg,rgba(201,169,98,0.07),transparent_60%)]',
          muted && 'opacity-60 hover:opacity-100',
          dimmed && 'opacity-50 hover:opacity-90',
        )}
      >
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-0.5 bg-[var(--gold)] origin-top scale-y-0 transition-transform duration-200 group-hover:scale-y-100"
        />

        <Checkbox checked={selected} />

        <div className="flex items-center gap-2.5 min-w-0">
          <span
            aria-hidden
            className={cn(
              'inline-block size-2.5 rounded-full shrink-0 transition-colors',
              selected ? 'bg-foreground/70' : 'border border-foreground/40 bg-transparent',
            )}
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
          muted={muted || dimmed}
        />

        {onDrill && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDrill(mover.entityId)
            }}
            aria-label={`Drill into ${mover.entityName} capabilities`}
            className="size-5 rounded grid place-items-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-bold"
          >
            ↳
          </button>
        )}
      </div>
    </li>
  )
}

function Checkbox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-grid place-items-center size-[14px] rounded-[3px] border-[1.5px] transition-colors',
        checked
          ? 'bg-foreground border-foreground text-card'
          : 'bg-card border-foreground/30',
      )}
    >
      {checked && (
        <svg viewBox="0 0 10 10" width="10" height="10" aria-hidden>
          <polyline
            points="2,5 4.5,7.5 8,3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
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
function describeMover(
  mover: TrajectoryMover,
  opts: { muted?: boolean; selected: boolean },
): string {
  const parts: string[] = [mover.entityName]
  if (mover.latestScaled !== null) {
    parts.push(`latest ${Math.round(mover.latestScaled)}`)
  }
  const v = mover.deltaScaled
  if (v !== null) {
    if (v === 0) {
      parts.push('unchanged from first session')
    } else {
      parts.push(`${v > 0 ? 'up' : 'down'} ${Math.round(Math.abs(v))} from first session`)
    }
    if (opts.muted) parts.push('within noise')
  }
  parts.push(opts.selected ? 'showing on chart, click to hide' : 'hidden from chart, click to show')
  return parts.join(', ')
}

function formatDelta(v: number): string {
  const r = Math.round(v)
  return `${r >= 0 ? '+' : ''}${r}`
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
