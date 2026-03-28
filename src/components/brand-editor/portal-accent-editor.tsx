"use client"

import { ColorPicker } from "./color-picker"
import type { PortalAccents } from "@/lib/brand/types"
import { DEFAULT_PORTAL_ACCENTS } from "@/lib/brand/defaults"

interface PortalAccentEditorProps {
  value: PortalAccents | undefined
  onChange: (accents: PortalAccents) => void
}

const PORTALS = [
  { key: "admin" as const, label: "Admin Portal", description: "Platform administration accent." },
  { key: "partner" as const, label: "Partner Portal", description: "Consulting partner accent." },
  { key: "client" as const, label: "Client Portal", description: "Organisation client accent." },
]

export function PortalAccentEditor({ value, onChange }: PortalAccentEditorProps) {
  const accents = value ?? { ...DEFAULT_PORTAL_ACCENTS }

  const handleChange = (key: keyof PortalAccents, hex: string) => {
    onChange({ ...accents, [key]: hex })
  }

  return (
    <div className="space-y-5">
      {PORTALS.map((portal) => (
        <ColorPicker
          key={portal.key}
          label={portal.label}
          description={portal.description}
          value={accents[portal.key]}
          onChange={(hex) => handleChange(portal.key, hex)}
        />
      ))}
    </div>
  )
}
