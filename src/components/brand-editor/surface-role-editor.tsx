"use client"

import { DerivedColorEditor } from "./derived-color-editor"
import type { DerivedColorField } from "./derived-color-editor"
import { resolveSurfaceRoles } from "@/lib/brand/tokens"
import type { BrandConfig, SurfaceRoleColors } from "@/lib/brand/types"

type Role = keyof SurfaceRoleColors

const ROLES: readonly DerivedColorField<Role>[] = [
  {
    key: "surface",
    label: "Surface",
    description: "Base branded surface — runner panels, report pages, email body.",
  },
  {
    key: "surfaceRaised",
    label: "Raised surface",
    description: "Cards and panels lifted off the base surface.",
  },
  {
    key: "text",
    label: "Body text",
    description: "Primary copy on branded surfaces.",
  },
  {
    key: "textMuted",
    label: "Muted text",
    description: "Secondary copy, captions, helper text.",
  },
  {
    key: "border",
    label: "Border",
    description: "Hairlines and dividers.",
  },
]

interface SurfaceRoleEditorProps {
  /** The fully resolved config, including any pins already applied. */
  config: BrandConfig
  value: SurfaceRoleColors | undefined
  onChange: (next: SurfaceRoleColors | undefined) => void
}

export function SurfaceRoleEditor({
  config,
  value,
  onChange,
}: SurfaceRoleEditorProps) {
  // Derive with the pins stripped, so the "Derived" state shows what the
  // pipeline would produce on its own rather than echoing the pin back.
  const derived = resolveSurfaceRoles({ ...config, surfaceColors: undefined })

  return (
    <DerivedColorEditor
      fields={ROLES}
      value={value}
      derived={derived}
      onChange={onChange}
    />
  )
}
