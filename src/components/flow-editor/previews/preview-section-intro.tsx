"use client"

import { PreviewShell } from "./preview-shell"
import type { SectionIntroContent } from "@/lib/experience/types"

interface PreviewSectionIntroProps {
  content: SectionIntroContent
}

export function PreviewSectionIntro({ content }: PreviewSectionIntroProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="space-y-4">
        {content.eyebrow && (
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--brand-primary)" }}
          >
            {content.eyebrow}
          </p>
        )}
        <h2
          className="text-lg font-semibold"
          style={{
            color: "var(--brand-text)",
            fontFamily: "var(--brand-font-heading)",
          }}
        >
          {content.heading}
        </h2>
        <p
          className="text-sm leading-relaxed whitespace-pre-line"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body}
        </p>

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
