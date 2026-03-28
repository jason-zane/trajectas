"use client"

import { PreviewShell } from "./preview-shell"
import type { CompleteContent } from "@/lib/experience/types"

interface PreviewCompleteProps {
  content: CompleteContent
}

export function PreviewComplete({ content }: PreviewCompleteProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
        {/* Success icon */}
        <div
          className="flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--brand-primary)" }}
        >
          <svg
            className="size-6"
            style={{ color: "var(--brand-primary-foreground)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

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
          className="text-sm leading-relaxed max-w-[280px]"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body}
        </p>
      </div>
    </PreviewShell>
  )
}
