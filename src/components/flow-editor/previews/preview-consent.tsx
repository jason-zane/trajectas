"use client"

import { PreviewShell } from "./preview-shell"
import type { ConsentContent } from "@/lib/experience/types"

interface PreviewConsentProps {
  content: ConsentContent
}

export function PreviewConsent({ content }: PreviewConsentProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="space-y-6">
        <p
          className="text-[0.75rem] font-semibold uppercase tracking-[0.16em]"
          style={{
            color: "var(--runner-overline)",
            fontFamily: '"Geist Mono", monospace',
            letterSpacing: "0.16em",
          }}
        >
          {content.eyebrow}
        </p>
        <div className="space-y-3">
          <h2
            className="text-xl font-semibold"
            style={{
              color: "var(--runner-display)",
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 600,
            }}
          >
            {content.heading}
          </h2>
          <div
            className="text-xs leading-relaxed whitespace-pre-line"
            style={{ color: "var(--runner-text-muted)" }}
          >
            {content.body.slice(0, 200)}
            {content.body.length > 200 && "..."}
          </div>
        </div>

        {/* Checkbox */}
        <div className="flex items-start gap-2 pt-1">
          <div
            className="mt-0.5 size-4 shrink-0 rounded border"
            style={{
              borderColor: "var(--runner-ghost-border)",
              backgroundColor: "var(--runner-accent)",
            }}
          />
          <span
            className="text-[11px] leading-snug"
            style={{ color: "var(--runner-text)" }}
          >
            {content.consentCheckboxLabel}
          </span>
        </div>

        <button
          type="button"
          className="w-full py-3 text-sm font-medium transition-all duration-150"
          style={{
            backgroundColor: "var(--runner-cta-fill)",
            color: "var(--runner-cta-text)",
            borderRadius: "8px",
          }}
        >
          {content.buttonLabel}
        </button>
      </div>
    </PreviewShell>
  )
}
