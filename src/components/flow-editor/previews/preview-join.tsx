"use client"

import { PreviewShell } from "./preview-shell"
import type { JoinContent } from "@/lib/experience/types"

interface PreviewJoinProps {
  content: JoinContent
}

export function PreviewJoin({ content }: PreviewJoinProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="space-y-4">
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
          className="text-sm leading-relaxed"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body}
        </p>

        {/* Mock form fields */}
        <div className="space-y-3 pt-2">
          <div
            className="h-9 rounded-md"
            style={{
              backgroundColor: "var(--brand-neutral-100)",
              border: "1px solid var(--brand-neutral-200)",
              borderRadius: "var(--brand-radius-md)",
            }}
          />
          <div
            className="h-9 rounded-md"
            style={{
              backgroundColor: "var(--brand-neutral-100)",
              border: "1px solid var(--brand-neutral-200)",
              borderRadius: "var(--brand-radius-md)",
            }}
          />
          <div
            className="h-9 rounded-md"
            style={{
              backgroundColor: "var(--brand-neutral-100)",
              border: "1px solid var(--brand-neutral-200)",
              borderRadius: "var(--brand-radius-md)",
            }}
          />
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
