'use client'

import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { SpacingDensity } from '@/lib/brand/types'

interface DensitySelectorProps {
  value: SpacingDensity | undefined
  onChange: (density: SpacingDensity) => void
}

const DENSITY_PRESETS = [
  {
    value: 'compact' as const,
    label: 'Compact',
    description: 'Tighter spacing',
    bars: [4, 6, 8],
  },
  {
    value: 'comfortable' as const,
    label: 'Comfortable',
    description: 'Balanced',
    bars: [5, 8, 11],
  },
  {
    value: 'spacious' as const,
    label: 'Spacious',
    description: 'Loose spacing',
    bars: [6, 10, 14],
  },
]

/**
 * Spacing density selector with visual bar preview.
 */
export function DensitySelector({ value, onChange }: DensitySelectorProps) {
  const density = value ?? 'comfortable'

  return (
    <div className="space-y-3">
      <Label>Spacing Density</Label>
      <div className="grid gap-3 sm:grid-cols-3">
        {DENSITY_PRESETS.map((preset) => {
          const isActive = density === preset.value

          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cn(
                'rounded-lg border p-3 transition-all duration-200',
                isActive
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                  : 'border-border bg-background hover:border-foreground/20 hover:bg-muted/30'
              )}
            >
              {/* Label */}
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p
                    className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {preset.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {preset.description}
                  </p>
                </div>
                {isActive && (
                  <div className="h-2 w-2 rounded-full bg-primary" />
                )}
              </div>

              {/* Spacing bars preview */}
              <div className="flex items-end gap-2">
                {preset.bars.map((height, idx) => (
                  <div
                    key={idx}
                    className="flex-1 rounded-sm bg-primary/30"
                    style={{ height: `${height}px` }}
                  />
                ))}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
