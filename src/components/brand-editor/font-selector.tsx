"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FontOption } from "@/lib/brand/fonts"

const CATEGORY_LABELS: Record<FontOption["category"], string> = {
  sans: "Sans-serif",
  serif: "Serif",
  mono: "Monospace",
}

const CATEGORY_ORDER: FontOption["category"][] = ["sans", "serif", "mono"]

interface FontSelectorProps {
  label: string
  value: string
  onChange: (fontName: string) => void
  fonts: FontOption[]
  /** CSS font-family to render the preview text in. */
  previewFamily?: string
}

export function FontSelector({
  label,
  value,
  onChange,
  fonts,
  previewFamily,
}: FontSelectorProps) {
  const id = useId()
  const selectedFont = fonts.find((f) => f.name === value)
  const displayFamily =
    previewFamily || selectedFont?.family || "system-ui, sans-serif"

  const groupedFonts = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    items: fonts.filter((f) => f.category === category),
  })).filter((group) => group.items.length > 0)

  const showGroupLabels = groupedFonts.length > 1

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={(v) => { if (v) onChange(v) }}>
        <SelectTrigger className="w-full h-9" id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groupedFonts.map((group) => (
            <SelectGroup key={group.category}>
              {showGroupLabels ? <SelectLabel>{group.label}</SelectLabel> : null}
              {group.items.map((font) => (
                <SelectItem key={font.name} value={font.name}>
                  <span style={{ fontFamily: font.family }}>{font.name}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      {/* Font preview */}
      <div
        className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-sm text-muted-foreground"
        style={{ fontFamily: displayFamily }}
      >
        The quick brown fox jumps over the lazy dog
      </div>
    </div>
  )
}
