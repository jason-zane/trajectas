"use client"

import { PreviewShell } from "./preview-shell"
import type { DemographicsContent } from "@/lib/experience/types"

interface PreviewDemographicsProps {
  content: DemographicsContent
}

export function PreviewDemographics({ content }: PreviewDemographicsProps) {
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
        <p
          className="text-xs leading-relaxed"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body}
        </p>

        {/* Mock form fields */}
        <div className="space-y-3 pt-1">
          {["Age Range", "Gender", "Education Level"].map((label) => (
            <div key={label} className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--brand-text-muted)" }}
              >
                {label}
              </span>
              <div
                className="h-8 rounded-md"
                style={{
                  backgroundColor: "var(--brand-neutral-100)",
                  border: "1px solid var(--brand-neutral-200)",
                  borderRadius: "var(--brand-radius-md)",
                }}
              />
            </div>
          ))}
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
