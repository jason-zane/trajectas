"use client"

import { PreviewShell } from "./preview-shell"
import type { ReviewContent } from "@/lib/experience/types"

interface PreviewReviewProps {
  content: ReviewContent
}

export function PreviewReview({ content }: PreviewReviewProps) {
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
          className="text-sm"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body}
        </p>

        {/* Mock section review cards */}
        <div className="space-y-2 pt-1">
          {["Leadership Assessment", "Values Assessment"].map((name, i) => (
            <div
              key={name}
              className="flex items-center justify-between rounded-lg p-3"
              style={{
                backgroundColor: "var(--brand-neutral-100)",
                borderRadius: "var(--brand-radius-lg)",
              }}
            >
              <span
                className="text-xs font-medium"
                style={{ color: "var(--brand-text)" }}
              >
                {name}
              </span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: i === 0
                    ? "var(--brand-primary)"
                    : "var(--brand-neutral-200)",
                  color: i === 0
                    ? "var(--brand-primary-foreground)"
                    : "var(--brand-text-muted)",
                }}
              >
                {i === 0 ? "Complete" : "12 / 15"}
              </span>
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
