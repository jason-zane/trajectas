'use client'

import { cn } from '@/lib/utils'
import type { TrajectoryViewLevel } from '@/lib/trajectory/url-params'

/**
 * Segmented control that flips the whole section between the at-a-glance
 * Dimensions view (≈ 5 lines) and the granular Capabilities view (all
 * factors ranked flat). Counts are shown so the scale at each level is
 * always visible.
 */
export function TrajectoryLevelToggle({
  value,
  dimensionCount,
  capabilityCount,
  onChange,
  disabled,
}: {
  value: TrajectoryViewLevel
  dimensionCount: number
  capabilityCount: number
  onChange: (next: TrajectoryViewLevel) => void
  disabled?: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label="Trajectory view level"
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-muted/50 p-0.5 text-xs font-semibold',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <ToggleButton
        active={value === 'dimension'}
        onClick={() => onChange('dimension')}
        label="Dimensions"
        count={dimensionCount}
      />
      <ToggleButton
        active={value === 'factor'}
        onClick={() => onChange('factor')}
        label="Capabilities"
        count={capabilityCount}
      />
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'rounded-full px-3.5 py-1.5 transition-colors tracking-tight',
        active
          ? 'bg-card text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
      <span
        className={cn(
          'ml-1.5 font-mono text-[10px] tabular-nums',
          active ? 'opacity-55' : 'opacity-50',
        )}
      >
        {count}
      </span>
    </button>
  )
}
