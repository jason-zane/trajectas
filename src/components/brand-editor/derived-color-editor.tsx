"use client"

import { useCallback, useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const HEX_REGEX = /^#[0-9a-fA-F]{6}$/

export interface DerivedColorField<K extends string> {
  key: K
  label: string
  description: string
}

interface DerivedColorEditorProps<K extends string> {
  fields: readonly DerivedColorField<K>[]
  /** Pinned values. A missing member means "keep the derived colour". */
  value: Partial<Record<K, string>> | undefined
  /** What the token pipeline produces when nothing is pinned. */
  derived: Record<K, string>
  /** Called with `undefined` once the last pin is cleared. */
  onChange: (next: Partial<Record<K, string>> | undefined) => void
  /**
   * Backdrop behind the swatches. Runner anchors are designed against ink,
   * so previewing them on the editor's white card misreads them badly.
   */
  swatchBackdrop?: string
}

/**
 * Editor for a group of colours that are normally DERIVED but may be pinned
 * individually.
 *
 * Each row shows the colour currently in effect, and states plainly whether
 * that value is derived or pinned — the distinction matters, because a
 * derived value keeps tracking the brand colours while a pinned one stops.
 */
export function DerivedColorEditor<K extends string>({
  fields,
  value,
  derived,
  onChange,
  swatchBackdrop,
}: DerivedColorEditorProps<K>) {
  const groupId = useId()

  const setRole = useCallback(
    (key: K, hex: string | null) => {
      const next: Partial<Record<K, string>> = { ...value }
      if (hex === null) {
        delete next[key]
      } else {
        next[key] = hex
      }
      onChange(Object.keys(next).length === 0 ? undefined : next)
    },
    [onChange, value]
  )

  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const pinned = value?.[field.key]
        const effective = pinned ?? derived[field.key]
        const id = `${groupId}-${field.key}`

        return (
          <div key={field.key} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={id}>{field.label}</Label>
              {pinned ? (
                <button
                  type="button"
                  onClick={() => setRole(field.key, null)}
                  className="text-xs text-primary hover:underline"
                >
                  Reset to derived
                </button>
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  Derived
                </span>
              )}
            </div>
            <p className="text-caption text-muted-foreground">
              {field.description}
            </p>
            <div
              className="flex items-center gap-2 rounded-lg p-2"
              style={
                swatchBackdrop ? { backgroundColor: swatchBackdrop } : undefined
              }
            >
              <Input
                id={id}
                type="text"
                value={effective}
                onChange={(e) => {
                  let v = e.target.value
                  if (v && !v.startsWith("#")) v = "#" + v
                  setRole(field.key, v)
                }}
                placeholder={derived[field.key]}
                className="flex-1 bg-background font-mono text-sm"
                maxLength={7}
              />
              <label className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-input shadow-sm transition-shadow hover:shadow-md">
                <input
                  type="color"
                  value={HEX_REGEX.test(effective) ? effective : "#000000"}
                  onChange={(e) => setRole(field.key, e.target.value)}
                  className="absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <div
                  className="size-full rounded-[7px]"
                  style={{ backgroundColor: effective }}
                />
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}
