"use client"

import { PreviewShell } from "./preview-shell"
import type { DemographicsContent } from "@/lib/experience/types"

interface PreviewDemographicsProps {
  content: DemographicsContent
}

export function PreviewDemographics({ content }: PreviewDemographicsProps) {
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
          <p
            className="text-xs leading-relaxed"
            style={{ color: "var(--runner-text-muted)" }}
          >
            {content.body}
          </p>
        </div>

        {/* Mock form fields */}
        <div className="space-y-3 pt-1">
          {["Age Range", "Gender", "Education Level"].map((label) => (
            <div key={label} className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--runner-text-muted)" }}
              >
                {label}
              </span>
              <div
                className="h-8 rounded-lg"
                style={{
                  backgroundColor: "var(--runner-input-fill)",
                  border: `1px solid var(--runner-input-border)`,
                  borderRadius: "8px",
                }}
              />
            </div>
          ))}
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
