import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type Mode = 'value' | 'delta'

/**
 * Shared score-cell renderer used by both the Compare matrix and the
 * Trajectory matrix. Renders a numeric score or an em-dash for null.
 *
 * `isRollup` styles the cell as a parent (heavier text + accent border on
 * the left edge). Used by Compare for the dimension/factor rollup column.
 *
 * `showBar` adds a thin band-coloured micro-bar beneath the number, filled
 * proportionally to the score (0–100). The bar inherits its colour from the
 * `style` resolver so the band scheme drives both number background and bar.
 *
 * `mode='delta'` overlays a signed delta-vs-`groupMean` indicator beside the
 * absolute number, so the user keeps the score context while reading
 * relative position. Bar is suppressed in delta mode to keep the cell tight.
 */
export function ScoreCell({
  value,
  style,
  isRollup = false,
  showBar = false,
  mode = 'value',
  groupMean = null,
}: {
  value: number | null
  style?: CSSProperties
  isRollup?: boolean
  showBar?: boolean
  mode?: Mode
  groupMean?: number | null
}) {
  const isEmpty = value === null
  const delta =
    mode === 'delta' && value !== null && groupMean !== null
      ? Math.round(value - groupMean)
      : null

  return (
    <td
      className={cn(
        'text-center font-semibold text-[11px] min-w-[44px] px-1.5 py-1 border-b border-r border-border last:border-r-0 tabular-nums align-middle',
        isRollup && 'font-extrabold border-l-2 border-l-border/40',
      )}
      style={style}
    >
      {isEmpty ? (
        <span className="opacity-60">—</span>
      ) : mode === 'delta' ? (
        <ValueWithDelta value={value} delta={delta} />
      ) : (
        <div className="flex flex-col items-stretch gap-0.5">
          <span className="leading-tight text-center">{value}</span>
          {showBar && <MicroBar value={value} style={style} />}
        </div>
      )}
    </td>
  )
}

function MicroBar({ value, style }: { value: number; style?: CSSProperties }) {
  const pct = Math.max(0, Math.min(100, value))
  const tint = style?.backgroundColor
  return (
    <div className="relative h-1 w-full rounded-full bg-foreground/10 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-200"
        style={{
          width: `${pct}%`,
          backgroundColor:
            typeof tint === 'string' ? tint : 'var(--primary)',
          opacity: 0.9,
        }}
      />
    </div>
  )
}

function ValueWithDelta({
  value,
  delta,
}: {
  value: number
  delta: number | null
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 leading-tight">
      <span className="text-foreground">{value}</span>
      <DeltaBadge delta={delta} />
    </div>
  )
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-[9.5px] text-muted-foreground">—</span>
  }
  if (delta === 0) {
    return <span className="text-[9.5px] text-muted-foreground tabular-nums">±0</span>
  }
  const positive = delta > 0
  return (
    <span
      className={cn(
        'text-[9.5px] font-semibold tabular-nums leading-none',
        // Site palette: primary (emerald) for positive movement,
        // destructive for negative. Matches the rest of the dashboard.
        positive ? 'text-primary' : 'text-destructive',
      )}
    >
      {positive ? '+' : ''}
      {delta}
    </span>
  )
}
