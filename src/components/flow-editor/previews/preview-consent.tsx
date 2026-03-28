"use client"

import { PreviewShell } from "./preview-shell"
import type { ConsentContent } from "@/lib/experience/types"

interface PreviewConsentProps {
  content: ConsentContent
}

export function PreviewConsent({ content }: PreviewConsentProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="space-y-4">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: "var(--brand-primary)" }}
        >
          {content.eyebrow}
        </p>
        <h2
          className="text-lg font-semibold"
          style={{
            color: "var(--brand-text)",
            fontFamily: "var(--brand-font-heading)",
          }}
        >
          {content.heading}
        </h2>
        <div
          className="text-xs leading-relaxed whitespace-pre-line"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body.slice(0, 200)}
          {content.body.length > 200 && "..."}
        </div>

        {/* Checkbox */}
        <div className="flex items-start gap-2 pt-1">
          <div
            className="mt-0.5 size-4 shrink-0 rounded border"
            style={{
              borderColor: "var(--brand-neutral-300)",
              backgroundColor: "var(--brand-primary)",
            }}
          />
          <span
            className="text-[11px] leading-snug"
            style={{ color: "var(--brand-text)" }}
          >
            {content.consentCheckboxLabel}
          </span>
        </div>

        <button
          type="button"
          className="w-full py-2 text-sm font-medium"
          style={{
            backgroundColor: "var(--brand-primary)",
            color: "var(--brand-primary-foreground)",
            borderRadius: "var(--brand-radius-md)",
          }}
        >
          {content.buttonLabel}
        </button>
      </div>
    </PreviewShell>
  )
}
