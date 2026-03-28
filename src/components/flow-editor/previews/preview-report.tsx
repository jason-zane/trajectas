"use client"

import { PreviewShell } from "./preview-shell"
import type { ReportContent } from "@/lib/experience/types"

interface PreviewReportProps {
  content: ReportContent
}

export function PreviewReport({ content }: PreviewReportProps) {
  const isHolding = content.reportMode === "holding"

  return (
    <PreviewShell footerText={content.footerText}>
      <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
        {/* Icon */}
        <div
          className="flex size-12 items-center justify-center rounded-full"
          style={{
            backgroundColor: isHolding
              ? "var(--brand-neutral-200)"
              : "var(--brand-primary)",
          }}
        >
          <svg
            className="size-6"
            style={{
              color: isHolding
                ? "var(--brand-text-muted)"
                : "var(--brand-primary-foreground)",
            }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
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

        {!isHolding && (
          <button
            type="button"
            className="py-2 px-6 text-sm font-medium"
            style={{
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-primary-foreground)",
              borderRadius: "var(--brand-radius-md)",
            }}
          >
            {content.buttonLabel}
          </button>
        )}
      </div>
    </PreviewShell>
  )
}
