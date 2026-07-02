'use client'

import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { ColorPicker } from './color-picker'
import type { GradientAccent } from '@/lib/brand/types'

interface GradientEditorProps {
  value: GradientAccent | undefined
  onChange: (gradient: GradientAccent | undefined) => void
  /** Primary color hex (used as default gradient start). */
  primaryColor: string
  /** Accent color hex (used as default gradient end). */
  accentColor: string
}

/**
 * Gradient accent editor: enable/disable switch, angle input, color pickers,
 * and live gradient preview swatch.
 */
export function GradientEditor({
  value,
  onChange,
  primaryColor,
  accentColor,
}: GradientEditorProps) {
  const idPrefix = useId()
  const gradient = value || { enabled: false }
  const isEnabled = gradient.enabled
  const angle = gradient.angle ?? 135
  const fromColor = gradient.from ?? primaryColor
  const toColor = gradient.to ?? accentColor

  const handleToggle = (enabled: boolean) => {
    onChange({
      enabled,
      angle: gradient.angle ?? 135,
      from: gradient.from,
      to: gradient.to,
    })
  }

  const handleAngleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAngle = parseInt(e.target.value, 10)
    if (isNaN(newAngle)) return
    onChange({
      ...gradient,
      angle: Math.max(0, Math.min(360, newAngle)),
    })
  }

  const handleFromChange = (hex: string) => {
    onChange({
      ...gradient,
      from: hex,
    })
  }

  const handleToChange = (hex: string) => {
    onChange({
      ...gradient,
      to: hex,
    })
  }

  // Generate CSS gradient for preview
  const gradientCSS =
    isEnabled && fromColor && toColor
      ? `linear-gradient(${angle}deg, ${fromColor}, ${toColor})`
      : `linear-gradient(135deg, ${primaryColor}, ${accentColor})`

  return (
    <div className="space-y-4">
      {/* Enable/disable toggle */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div>
          <Label className="text-sm font-medium">Gradient Accent</Label>
          <p className="text-[12px] text-muted-foreground">
            Optional animated gradient overlay
          </p>
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={handleToggle}
          id={`${idPrefix}-gradient-toggle`}
        />
      </div>

      {isEnabled && (
        <div className="space-y-4 rounded-lg border border-border bg-background p-4">
          {/* Angle input */}
          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-angle`}>Angle (degrees)</Label>
            <div className="flex items-center gap-3">
              <Input
                id={`${idPrefix}-angle`}
                type="number"
                min="0"
                max="360"
                value={angle}
                onChange={handleAngleChange}
                className="h-9 font-mono"
              />
              <input
                type="range"
                min="0"
                max="360"
                value={angle}
                onChange={handleAngleChange}
                className="flex-1"
              />
            </div>
          </div>

          {/* Color pickers */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ColorPicker
              label="From Color"
              description="Start of gradient"
              value={fromColor}
              onChange={handleFromChange}
            />
            <ColorPicker
              label="To Color"
              description="End of gradient"
              value={toColor}
              onChange={handleToChange}
            />
          </div>

          {/* Live preview swatch */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <div
              className="h-24 w-full rounded-lg border border-border shadow-sm"
              style={{ background: gradientCSS }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
