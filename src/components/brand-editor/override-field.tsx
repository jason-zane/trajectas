'use client'

import { ReactNode } from 'react'
import { X } from 'lucide-react'

interface OverrideFieldProps {
  /** Optional label above the field. */
  label?: string
  /** Whether this field is currently overridden. */
  overridden: boolean
  /** Called when the reset chip is clicked. */
  onReset: () => void
  /** The control being wrapped. */
  children: ReactNode
  /** Optional hint text shown when overridden. */
  inheritedHint?: string
}

/**
 * Wrapper for a single overridable field, rendering an "Inherited" or "Customised" chip.
 *
 * When overridden, shows a subtle reset affordance. Editing the wrapped control
 * is handled by the parent — this component is presentational only.
 */
export function OverrideField({
  label,
  overridden,
  onReset,
  children,
  inheritedHint,
}: OverrideFieldProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{label}</p>
          {overridden ? (
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[11px] font-medium text-primary">
                Customised
              </span>
              <button
                type="button"
                onClick={onReset}
                className="inline-flex items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Reset to inherited value"
              >
                <X className="h-3 w-3" />
                <span className="sr-only">Reset</span>
              </button>
            </div>
          ) : (
            <span className="rounded-full bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground">
              Inherited
            </span>
          )}
        </div>
      )}
      {overridden && inheritedHint && (
        <p className="text-[12px] text-muted-foreground">{inheritedHint}</p>
      )}
      {children}
    </div>
  )
}
