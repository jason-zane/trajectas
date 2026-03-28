"use client"

import { ColorPicker } from "./color-picker"
import type { EmailStyleColors } from "@/lib/brand/types"
import { DEFAULT_EMAIL_STYLES } from "@/lib/brand/defaults"

interface EmailStyleEditorProps {
  value: EmailStyleColors | undefined
  onChange: (styles: EmailStyleColors) => void
}

const FIELDS = [
  { key: "textColor" as const, label: "Body Text Color", description: "Main text color in email body." },
  { key: "highlightColor" as const, label: "Highlight Color", description: "Bold/emphasis text and inline links." },
  { key: "footerTextColor" as const, label: "Footer Text Color", description: "Muted text in the email footer." },
]

export function EmailStyleEditor({ value, onChange }: EmailStyleEditorProps) {
  const styles = value ?? { ...DEFAULT_EMAIL_STYLES }

  const handleChange = (key: keyof EmailStyleColors, hex: string) => {
    onChange({ ...styles, [key]: hex })
  }

  return (
    <div className="space-y-5">
      {FIELDS.map((field) => (
        <ColorPicker
          key={field.key}
          label={field.label}
          description={field.description}
          value={styles[field.key]}
          onChange={(hex) => handleChange(field.key, hex)}
        />
      ))}
    </div>
  )
}
