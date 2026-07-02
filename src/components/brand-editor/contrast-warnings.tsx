'use client'

import { AlertCircle } from 'lucide-react'
import { auditBrandContrast } from '@/lib/brand/contrast'
import type { BrandConfig } from '@/lib/brand/types'

interface ContrastWarningsProps {
  config: BrandConfig
}

/**
 * Renders a compact warning panel when WCAG contrast failures are detected.
 *
 * Advisory only — does not block saves. Uses the same contrast auditor
 * that runs client-side for live warnings.
 */
export function ContrastWarnings({ config }: ContrastWarningsProps) {
  const checks = auditBrandContrast(config)
  const failures = checks.filter((c) => !c.passes)

  if (failures.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div className="flex gap-3">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-amber-600 mt-0.5" />
        <div className="flex-1 space-y-3">
          <div>
            <h3 className="text-sm font-medium text-amber-900">
              Contrast Warnings
            </h3>
            <p className="text-[12px] text-amber-800">
              Some color pairs fall below WCAG AA standards. Consider adjusting
              your colors for better accessibility.
            </p>
          </div>

          <div className="space-y-2">
            {failures.map((failure) => (
              <div key={failure.id} className="rounded bg-white/50 p-2 text-[12px]">
                <div className="flex items-start gap-2">
                  <div className="flex items-center gap-1.5 flex-1">
                    {/* Color swatches */}
                    <div className="flex gap-1">
                      <div
                        className="h-4 w-4 rounded border border-foreground/10 flex-shrink-0"
                        style={{ backgroundColor: failure.foreground }}
                        title={failure.foreground}
                      />
                      <span className="text-muted-foreground">on</span>
                      <div
                        className="h-4 w-4 rounded border border-foreground/10 flex-shrink-0"
                        style={{ backgroundColor: failure.background }}
                        title={failure.background}
                      />
                    </div>
                    {/* Ratio */}
                    <span className="text-foreground font-medium">
                      {failure.ratio}:1
                    </span>
                    <span className="text-muted-foreground">
                      (needs {failure.required}:1)
                    </span>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1">{failure.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {failure.context}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
