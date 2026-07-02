'use client'

import { useMemo } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { resolveTypeLevels } from '@/lib/brand/tokens'
import type { TypographySettings, BrandConfig } from '@/lib/brand/types'

interface TypeScaleSelectorProps {
  value: TypographySettings | undefined
  onChange: (settings: TypographySettings) => void
  /**
   * Seed config for resolveTypeLevels — used to preview the type ramp
   * with the current color and other settings. Typically the effective
   * (merged) brand config.
   */
  seedConfig: BrandConfig
}

const SCALE_PRESETS = [
  { value: 'compact' as const, label: 'Compact', scale: 0.85 },
  { value: 'default' as const, label: 'Default', scale: 1 },
  { value: 'generous' as const, label: 'Generous', scale: 1.2 },
]

const WEIGHT_OPTIONS = [400, 500, 600, 700, 800] as const
const BODY_WEIGHT_OPTIONS = [300, 400, 500] as const

/**
 * Type scale editor: preset cards with mini preview ramps, plus
 * heading/body weight selects.
 *
 * Advanced per-level overrides (the `levels` field) are not exposed
 * in the editor yet — they are a config-only escape hatch for power users.
 */
export function TypeScaleSelector({
  value,
  onChange,
  seedConfig,
}: TypeScaleSelectorProps) {
  const settings = useMemo(() => value || {}, [value])
  const scale = settings.scale ?? 'default'
  const headingWeight = settings.headingWeight ?? 600
  const bodyWeight = settings.bodyWeight ?? 400

  const handleScaleChange = (newScale: typeof scale) => {
    onChange({
      ...settings,
      scale: newScale,
    })
  }

  const handleHeadingWeightChange = (w: string | null) => {
    if (!w) return
    onChange({
      ...settings,
      headingWeight: parseInt(w, 10),
    })
  }

  const handleBodyWeightChange = (w: string | null) => {
    if (!w) return
    onChange({
      ...settings,
      bodyWeight: parseInt(w, 10),
    })
  }

  return (
    <div className="space-y-5">
      {/* Scale preset cards */}
      <div>
        <Label className="mb-3 block">Type Scale Preset</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCALE_PRESETS.map((preset) => {
            const isActive = scale === preset.value
            const presetLevels = resolveTypeLevels({
              ...seedConfig,
              typography: { ...settings, scale: preset.value },
            })

            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleScaleChange(preset.value)}
                className={cn(
                  'rounded-lg border p-3 text-left transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border bg-background hover:border-foreground/20 hover:bg-muted/30'
                )}
              >
                {/* Label and selection indicator */}
                <div className="mb-2.5 flex items-center justify-between">
                  <span
                    className={cn(
                      'text-xs font-medium',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  >
                    {preset.label}
                  </span>
                  {isActive && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>

                {/* Mini type ramp preview */}
                <div className="space-y-1">
                  <div
                    style={{
                      fontSize: presetLevels.h3.size,
                      fontWeight: presetLevels.h3.weight,
                      lineHeight: presetLevels.h3.lineHeight,
                      letterSpacing: presetLevels.h3.letterSpacing,
                    }}
                    className="text-foreground"
                  >
                    Heading
                  </div>
                  <div
                    style={{
                      fontSize: presetLevels.body.size,
                      fontWeight: presetLevels.body.weight,
                      lineHeight: presetLevels.body.lineHeight,
                      letterSpacing: presetLevels.body.letterSpacing,
                    }}
                    className="text-muted-foreground"
                  >
                    Body text
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Weight selects */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="heading-weight">Heading Weight</Label>
          <Select value={String(headingWeight)} onValueChange={handleHeadingWeightChange}>
            <SelectTrigger id="heading-weight" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHT_OPTIONS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="body-weight">Body Weight</Label>
          <Select value={String(bodyWeight)} onValueChange={handleBodyWeightChange}>
            <SelectTrigger id="body-weight" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BODY_WEIGHT_OPTIONS.map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Note about advanced overrides */}
      <p className="text-[12px] text-muted-foreground">
        Per-level overrides (display, h1, h2, etc.) are available in advanced
        configuration only.
      </p>
    </div>
  )
}
