"use client"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import type { BrandConfig, RunnerTheme } from "@/lib/brand/types"
import { deriveRunnerAnchors } from "@/lib/brand/runner-tokens"

interface RunnerThemeSelectorProps {
  value: RunnerTheme
  onChange: (value: RunnerTheme) => void
  config: BrandConfig
}

const PRESETS: { value: RunnerTheme; label: string; description: string }[] = [
  {
    value: "dark",
    label: "Dark",
    description: "Ink surfaces, paper text. The Trajectas default.",
  },
  {
    value: "light",
    label: "Light",
    description: "Paper surfaces, ink accents.",
  },
]

function ThemePreview({ theme, anchors }: { theme: RunnerTheme; anchors: ReturnType<typeof deriveRunnerAnchors> }) {
  if (theme === "dark") {
    // Dark card: ink background with paper text line + accent hairline
    return (
      <div
        className="h-16 rounded-lg p-3 flex flex-col justify-between"
        style={{ backgroundColor: anchors.ink }}
      >
        <div
          style={{ backgroundColor: anchors.accent, height: "2px", width: "100%" }}
          className="rounded-full"
        />
        <div
          style={{ color: anchors.paper, height: "2px" }}
          className="text-xs font-medium overflow-hidden"
        >
          Sample text
        </div>
      </div>
    )
  }

  // Light card: lightPage background with ink text line + accent hairline
  return (
    <div
      className="h-16 rounded-lg p-3 flex flex-col justify-between border"
      style={{
        backgroundColor: anchors.lightPage,
        borderColor: anchors.accent,
      }}
    >
      <div
        style={{ backgroundColor: anchors.accent, height: "2px", width: "100%" }}
        className="rounded-full"
      />
      <div
        style={{ color: anchors.ink, height: "2px" }}
        className="text-xs font-medium overflow-hidden"
      >
        Sample text
      </div>
    </div>
  )
}

export function RunnerThemeSelector({
  value,
  onChange,
  config,
}: RunnerThemeSelectorProps) {
  const anchors = deriveRunnerAnchors(config)

  return (
    <div className="space-y-2">
      <Label>Assessment Runner Theme</Label>
      <div className="grid grid-cols-2 gap-3">
        {PRESETS.map((preset) => {
          const isActive = value === preset.value
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 transition-all duration-200 text-left",
                isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                  : "border-border bg-background hover:border-foreground/20 hover:bg-muted/30"
              )}
            >
              <ThemePreview theme={preset.value} anchors={anchors} />
              <div>
                <p
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-primary" : "text-foreground"
                  )}
                >
                  {preset.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {preset.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
