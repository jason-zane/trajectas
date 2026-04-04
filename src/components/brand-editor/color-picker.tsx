"use client"

import { useCallback, useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { hexToOklch, oklchToHex } from "@/lib/brand/tokens"

interface ColorPickerProps {
  label: string
  description?: string
  value: string
  onChange: (hex: string) => void
}

/**
 * Generate a 10-step lightness scale preview using fixed lightness positions.
 * Matches the `generateScale()` algorithm in tokens.ts exactly.
 */
function generateScalePreview(hex: string): { step: string; color: string }[] {
  const HEX_REGEX = /^#[0-9a-fA-F]{6}$/
  if (!HEX_REGEX.test(hex)) return []

  try {
    const base = hexToOklch(hex)

    const steps: { step: string; l: number; chromaScale: number }[] = [
      { step: "50", l: 0.97, chromaScale: 0.25 },
      { step: "100", l: 0.93, chromaScale: 0.35 },
      { step: "200", l: 0.88, chromaScale: 0.5 },
      { step: "300", l: 0.80, chromaScale: 0.65 },
      { step: "400", l: 0.70, chromaScale: 0.85 },
      { step: "500", l: 0.60, chromaScale: 1.0 },
      { step: "600", l: 0.52, chromaScale: 1.0 },
      { step: "700", l: 0.44, chromaScale: 0.95 },
      { step: "800", l: 0.35, chromaScale: 0.85 },
      { step: "900", l: 0.25, chromaScale: 0.70 },
    ]

    return steps.map(({ step, l, chromaScale }) => ({
      step,
      color: oklchToHex({ l, c: base.c * chromaScale, h: base.h }),
    }))
  } catch {
    return []
  }
}

export function ColorPicker({ label, description, value, onChange }: ColorPickerProps) {
  const id = useId()
  const scale = generateScalePreview(value)

  const handleHexInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let v = e.target.value
      if (v && !v.startsWith("#")) {
        v = "#" + v
      }
      onChange(v)
    },
    [onChange]
  )

  const handleSwatchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {description && (
        <p className="text-caption text-muted-foreground">{description}</p>
      )}
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="text"
          value={value}
          onChange={handleHexInput}
          placeholder="#2d6a5a"
          className="flex-1 font-mono text-sm"
          maxLength={7}
        />
        <label className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-input shadow-sm transition-shadow hover:shadow-md">
          <input
            type="color"
            value={value.match(/^#[0-9a-fA-F]{6}$/) ? value : "#000000"}
            onChange={handleSwatchChange}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          />
          <div
            className="size-full rounded-[7px]"
            style={{ backgroundColor: value }}
          />
        </label>
      </div>

      {/* Scale preview — fixed lightness steps */}
      {scale.length > 0 && (
        <div className="flex gap-1 pt-1">
          {scale.map(({ step, color }) => (
            <div key={step} className="flex-1 space-y-0.5">
              <div
                className="h-6 w-full rounded-md shadow-sm ring-1 ring-foreground/[0.06]"
                style={{ backgroundColor: color }}
                title={`${step}: ${color}`}
              />
              <p className="text-center text-[9px] text-muted-foreground/60">
                {step}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
