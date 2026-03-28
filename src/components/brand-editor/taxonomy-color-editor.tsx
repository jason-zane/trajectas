"use client"

import { ColorPicker } from "./color-picker"
import type { TaxonomyColors } from "@/lib/brand/types"
import { DEFAULT_TAXONOMY_COLORS } from "@/lib/brand/defaults"

interface TaxonomyColorEditorProps {
  value: TaxonomyColors | undefined
  onChange: (colors: TaxonomyColors) => void
}

const LEVELS = [
  { key: "dimension" as const, label: "Dimension", description: "Top-level grouping (e.g., Leadership, Cognitive)." },
  { key: "competency" as const, label: "Competency / Factor", description: "Mid-level factor within a dimension." },
  { key: "trait" as const, label: "Trait / Construct", description: "Underlying psychological trait." },
  { key: "item" as const, label: "Item", description: "Individual assessment question." },
]

export function TaxonomyColorEditor({ value, onChange }: TaxonomyColorEditorProps) {
  const colors = value ?? { ...DEFAULT_TAXONOMY_COLORS }

  const handleChange = (key: keyof TaxonomyColors, hex: string) => {
    onChange({ ...colors, [key]: hex })
  }

  return (
    <div className="space-y-5">
      {LEVELS.map((level) => (
        <ColorPicker
          key={level.key}
          label={level.label}
          description={level.description}
          value={colors[level.key]}
          onChange={(hex) => handleChange(level.key, hex)}
        />
      ))}
    </div>
  )
}
