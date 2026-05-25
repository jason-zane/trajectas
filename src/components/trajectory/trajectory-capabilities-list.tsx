'use client'

import { cn } from '@/lib/utils'
import { STABLE_THRESHOLD } from '@/lib/trajectory/rollup'
import type { TrajectorySeries } from '@/lib/trajectory/types'

/**
 * Flat ranked list of every capability (factor), sorted by |Δ| descending.
 * Each row carries a small parent-dimension chip so the hierarchy is still
 * legible without driving the sort.
 *
 * Capabilities that move within the ±STABLE_THRESHOLD noise floor sit below
 * a "Within noise" rule and fade to 60% until hovered.
 */
export function TrajectoryCapabilitiesList({
  series,
  selectedIds,
  onToggle,
  onSelectAll,
  onClearAll,
}: {
  /** Factor-level series. Already filtered to the parent dimension if applicable. */
  series: TrajectorySeries[]
  selectedIds: ReadonlySet<string>
  onToggle: (entityId: string) => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  const rows = buildRows(series)
  if (rows.length === 0) return null

  const maxAbsDelta = Math.max(
    ...rows.map((r) => Math.abs(r.delta ?? 0)),
    STABLE_THRESHOLD * 2,
  )
  const barScale = 45 / maxAbsDelta
  const noiseHalfPct = STABLE_THRESHOLD * barScale

  const movers = rows.filter((r) => r.aboveNoise)
  const stable = rows.filter((r) => !r.aboveNoise)
  const selectedCount = selectedIds.size

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3 pb-3 border-b border-border">
        <div className="flex items-baseline gap-3">
          <p className="text-overline text-[var(--gold)]">Biggest movers</p>
          <p className="text-caption text-muted-foreground tabular-nums">
            {selectedCount} of {rows.length} on chart
          </p>
        </div>
        <div className="flex items-center gap-3 text-caption text-muted-foreground">
          <span className="hidden sm:inline">Click to toggle chart visibility</span>
          <button
            type="button"
            onClick={selectedCount === rows.length ? onClearAll : onSelectAll}
            className="rounded-full border border-border px-2.5 py-0.5 text-[11px] hover:bg-muted transition-colors"
          >
            {selectedCount === rows.length ? 'Hide all' : 'Show all'}
          </button>
        </div>
      </header>

      <ul>
        {movers.map((r) => (
          <CapabilityRow
            key={r.entityId}
            row={r}
            barScale={barScale}
            noiseHalfPct={noiseHalfPct}
            selected={selectedIds.has(r.entityId)}
            onToggle={onToggle}
          />
        ))}

        {stable.length > 0 && <NoiseDivider hasMovers={movers.length > 0} />}

        {stable.map((r) => (
          <CapabilityRow
            key={r.entityId}
            row={r}
            barScale={barScale}
            noiseHalfPct={noiseHalfPct}
            muted
            selected={selectedIds.has(r.entityId)}
            onToggle={onToggle}
          />
        ))}
      </ul>
    </div>
  )
}

type Row = {
  entityId: string
  entityName: string
  parentName: string | null
  latest: number | null
  delta: number | null
  aboveNoise: boolean
  points: (number | null)[]
}

function buildRows(series: TrajectorySeries[]): Row[] {
  const rows: Row[] = []
  for (const s of series) {
    const points = s.points
    if (points.length === 0) continue
    const first = points[0]?.scaledScore ?? null
    const latest = points[points.length - 1]?.scaledScore ?? null
    const delta = first !== null && latest !== null ? latest - first : null
    rows.push({
      entityId: s.entityId,
      entityName: s.entityName,
      parentName: s.parentName,
      latest,
      delta,
      aboveNoise: delta !== null && Math.abs(delta) >= STABLE_THRESHOLD,
      points: points.map((p) => p.scaledScore),
    })
  }
  rows.sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
  return rows
}

function CapabilityRow({
  row,
  barScale,
  noiseHalfPct,
  muted,
  selected,
  onToggle,
}: {
  row: Row
  barScale: number
  noiseHalfPct: number
  muted?: boolean
  selected: boolean
  onToggle: (entityId: string) => void
}) {
  const positive = (row.delta ?? 0) >= 0
  const dimmed = !selected
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onToggle(row.entityId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onToggle(row.entityId)
          }
        }}
        aria-pressed={selected}
        aria-label={describeRow(row, { muted, selected })}
        className={cn(
          'group relative w-full text-left cursor-pointer',
          'grid items-center gap-x-4',
          'grid-cols-[18px_1.3fr_0.55fr_1.7fr_0.85fr]',
          'px-4 py-3 border-b border-border last:border-b-0',
          'transition-colors duration-200',
          'hover:bg-[var(--cream)] dark:hover:bg-muted/40',
          'focus:outline-none focus-visible:bg-[var(--cream)] dark:focus-visible:bg-muted/40',
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
          <div className="min-w-0 flex flex-col gap-1">
            <p className="text-sm font-semibold leading-tight truncate" title={row.entityName}>
              {row.entityName}
            </p>
            {row.parentName && <ParentChip name={row.parentName} />}
          </div>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold tabular-nums leading-none">
            {row.latest !== null ? Math.round(row.latest) : '—'}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
            Latest
          </p>
        </div>

        <MagnitudeBar
          delta={row.delta}
          barScale={barScale}
          noiseHalfPct={noiseHalfPct}
          positive={positive}
        />

        <Sparkline points={row.points} positive={positive} muted={muted || dimmed} />
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

function ParentChip({ name }: { name: string }) {
  return (
    <span className="inline-flex self-start items-center gap-1.5 rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/70" />
      {name}
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
  if (delta === null) return <div className="h-6" aria-hidden />
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
          positive ? 'bg-emerald-600 dark:bg-emerald-500' : 'bg-rose-500 dark:bg-rose-400',
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
          positive ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300',
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
  const H = 24
  const vals = points.filter((v): v is number => v !== null && Number.isFinite(v))
  if (vals.length === 0) return <div className="h-6" aria-hidden />

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
  const arrowColour = muted
    ? 'text-muted-foreground'
    : positive
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-rose-500 dark:text-rose-400'
  const strokeColour = muted
    ? 'stroke-muted-foreground/70'
    : positive
      ? 'stroke-emerald-600 dark:stroke-emerald-400'
      : 'stroke-rose-500 dark:stroke-rose-400'

  return (
    <div className="flex items-center justify-end gap-2" aria-hidden>
      <span className={cn('text-xs font-bold w-3 text-center', arrowColour)}>{arrow}</span>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width={W} height={H} className="block">
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
 * Screen-reader label for a row button. All visual elements inside the row
 * (dot, magnitude bar, sparkline arrow, delta number) are aria-hidden, so
 * this label carries the full meaning: capability name, parent dimension,
 * latest score, direction and size of change, and noise-floor status.
 */
function describeRow(
  row: Row,
  opts: { muted?: boolean; selected: boolean },
): string {
  const parts: string[] = [row.entityName]
  if (row.parentName) parts.push(`part of ${row.parentName}`)
  if (row.latest !== null) parts.push(`latest ${Math.round(row.latest)}`)
  const v = row.delta
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
  parts.push(opts.selected ? 'showing on chart, click to hide' : 'hidden from chart, click to show')
  return parts.join(', ')
}

function formatDelta(v: number): string {
  const r = Math.round(v * 10) / 10
  const sign = r >= 0 ? '+' : ''
  return `${sign}${Number.isInteger(r) ? r : r.toFixed(1)}`
}
