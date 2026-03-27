"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { BorderRadiusPreset } from "@/lib/brand/types"

interface RadiusSelectorProps {
  value: BorderRadiusPreset
  onChange: (value: BorderRadiusPreset) => void
  /** Used to color the preview shapes. Should be the current primary color hex. */
  previewColor?: string
}

const PRESETS: { value: BorderRadiusPreset; label: string; radius: number }[] = [
  { value: "sharp", label: "Sharp", radius: 4 },
  { value: "soft", label: "Soft", radius: 8 },
  { value: "round", label: "Round", radius: 16 },
]

export function RadiusSelector({ value, onChange, previewColor }: RadiusSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Border Radius</Label>
      <div className="flex gap-3">
        {PRESETS.map((preset) => {
          const isActive = value === preset.value
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cn(
                "flex flex-1 flex-col items-center gap-2 rounded-lg border p-3 transition-all duration-200",
                isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-background hover:border-foreground/20 hover:bg-muted/30"
              )}
            >
              <div
                className="size-10 transition-all duration-300"
                style={{
                  backgroundColor: previewColor || "var(--primary)",
                  borderRadius: `${preset.radius}px`,
                }}
              />
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {preset.label}
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                {preset.radius}px
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
