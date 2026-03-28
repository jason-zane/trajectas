"use client"

import { PreviewShell } from "./preview-shell"
import type { ExpiredContent } from "@/lib/experience/types"

interface PreviewExpiredProps {
  content: ExpiredContent
}

export function PreviewExpired({ content }: PreviewExpiredProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
        {/* Clock icon */}
        <div
          className="flex size-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--brand-neutral-200)" }}
        >
          <svg
            className="size-6"
            style={{ color: "var(--brand-text-muted)" }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M12 6v6l4 2" />
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
