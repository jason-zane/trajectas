'use client'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ButtonStyle, BorderRadiusPreset } from '@/lib/brand/types'

interface ButtonStyleEditorProps {
  value: ButtonStyle | undefined
  onChange: (style: ButtonStyle) => void
  /** Current border radius preset (for shape preview). */
  borderRadiusPreset: BorderRadiusPreset
  /** Primary color for preview buttons (hex). */
  primaryColor: string
}

const SHAPE_PRESETS = [
  { value: 'inherit' as const, label: 'Inherit', description: 'Follow radius preset' },
  { value: 'pill' as const, label: 'Pill', description: 'Fully rounded' },
  { value: 'sharp' as const, label: 'Sharp', description: 'Near square' },
]

const BORDER_RADIUS_MAP: Record<BorderRadiusPreset, number> = {
  sharp: 4,
  soft: 8,
  round: 16,
}

const WEIGHT_OPTIONS = [400, 500, 600, 700] as const
const TEXT_TRANSFORM_OPTIONS = [
  { value: 'none' as const, label: 'None' },
  { value: 'uppercase' as const, label: 'Uppercase' },
]

/**
 * Button style editor: shape presets with live preview, weight and case selects.
 */
export function ButtonStyleEditor({
  value,
  onChange,
  borderRadiusPreset,
  primaryColor,
}: ButtonStyleEditorProps) {
  const style = value || {}
  const shape = style.shape ?? 'inherit'
  const weight = style.weight ?? 500
  const textTransform = style.textTransform ?? 'none'

  const handleShapeChange = (newShape: typeof shape) => {
    onChange({
      ...style,
      shape: newShape,
    })
  }

  const handleWeightChange = (w: string | null) => {
    if (!w) return
    onChange({
      ...style,
      weight: parseInt(w, 10),
    })
  }

  const handleTransformChange = (transform: string | null) => {
    if (!transform) return
    onChange({
      ...style,
      textTransform: transform as 'none' | 'uppercase',
    })
  }

  return (
    <div className="space-y-5">
      {/* Shape presets with preview buttons */}
      <div>
        <Label className="mb-3 block">Button Shape</Label>
        <div className="grid gap-3 sm:grid-cols-3">
          {SHAPE_PRESETS.map((preset) => {
            const isActive = shape === preset.value
            const previewRadius =
              preset.value === 'inherit'
                ? BORDER_RADIUS_MAP[borderRadiusPreset]
                : preset.value === 'pill'
                  ? 999
                  : 4

            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => handleShapeChange(preset.value)}
                className={cn(
                  'rounded-lg border p-3 transition-all duration-200',
                  isActive
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'border-border bg-background hover:border-foreground/20 hover:bg-muted/30'
                )}
              >
                {/* Label */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-left">
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

                {/* Preview swatch — span, not button: nesting a button inside
                    the preset button is invalid HTML and breaks hydration */}
                <span
                  aria-hidden="true"
                  className="block w-full px-4 py-2 text-center font-medium text-white transition-colors"
                  style={{
                    backgroundColor: primaryColor,
                    borderRadius: `${previewRadius}px`,
                  }}
                >
                  Preview
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Weight and text-transform selects */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="button-weight">Button Weight</Label>
          <Select value={String(weight)} onValueChange={handleWeightChange}>
            <SelectTrigger id="button-weight" className="h-9">
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
          <Label htmlFor="button-transform">Text Transform</Label>
          <Select value={textTransform} onValueChange={handleTransformChange}>
            <SelectTrigger id="button-transform" className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEXT_TRANSFORM_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
