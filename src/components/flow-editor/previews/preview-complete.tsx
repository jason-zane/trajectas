"use client"

import { PreviewShell } from "./preview-shell"
import type { CompleteContent } from "@/lib/experience/types"

interface PreviewCompleteProps {
  content: CompleteContent
}

export function PreviewComplete({ content }: PreviewCompleteProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-8">
        {/* Success icon */}
        <div
          className="flex size-14 items-center justify-center rounded-full"
          style={{
            backgroundColor: "var(--runner-accent)",
            color: "var(--runner-ink)",
          }}
        >
          <svg
            className="size-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

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
            className="text-sm leading-relaxed max-w-xs"
            style={{ color: "var(--runner-text-muted)" }}
          >
            {content.body}
          </p>
        </div>
      </div>
    </PreviewShell>
  )
}
