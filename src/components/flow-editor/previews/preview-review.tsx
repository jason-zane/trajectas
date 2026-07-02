"use client"

import { PreviewShell } from "./preview-shell"
import type { ReviewContent } from "@/lib/experience/types"

interface PreviewReviewProps {
  content: ReviewContent
}

export function PreviewReview({ content }: PreviewReviewProps) {
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
            className="text-sm"
            style={{ color: "var(--runner-text-muted)" }}
          >
            {content.body}
          </p>
        </div>

        {/* Mock section review cards */}
        <div className="space-y-2 pt-1">
          {["Leadership Assessment", "Values Assessment"].map((name, i) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-lg p-3"
              style={{
                backgroundColor: "var(--runner-ghost-fill)",
                borderRadius: "8px",
                border: `1px solid var(--runner-hairline)`,
              }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "var(--runner-text)" }}
              >
                {name}
              </span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: i === 0
                    ? "var(--runner-accent)"
                    : "var(--runner-ghost-border)",
                  color: i === 0
                    ? "var(--runner-ink)"
                    : "var(--runner-text-muted)",
                }}
              >
                {i === 0 ? "Complete" : "12 / 15"}
              </span>
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
