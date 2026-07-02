"use client"

import { PreviewShell } from "./preview-shell"
import type { JoinContent } from "@/lib/experience/types"

interface PreviewJoinProps {
  content: JoinContent
}

export function PreviewJoin({ content }: PreviewJoinProps) {
  return (
    <PreviewShell footerText={content.footerText}>
      <div className="space-y-6">
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
            className="text-sm leading-relaxed"
            style={{ color: "var(--runner-text-muted)" }}
          >
            {content.body}
          </p>
        </div>

        {/* Mock form card */}
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{
            borderColor: "var(--runner-hairline)",
            backgroundColor: "var(--runner-ghost-fill)",
            borderRadius: "8px",
          }}
        >
          {/* Email field */}
          <div className="space-y-1">
            <span
              className="text-[10px] font-medium"
              style={{ color: "var(--runner-text)" }}
            >
              Email *
            </span>
            <div
              className="h-8 rounded-lg px-2 flex items-center"
              style={{
                backgroundColor: "var(--runner-input-fill)",
                border: `1px solid var(--runner-input-border)`,
                borderRadius: "8px",
              }}
            >
              <span
                className="text-[10px]"
                style={{ color: "var(--runner-text-muted)" }}
              >
                you@example.com
              </span>
            </div>
          </div>

          {/* Name fields in two columns */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--runner-text)" }}
              >
                First Name *
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
            <div className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--runner-text)" }}
              >
                Last Name *
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
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--runner-text)" }}
              >
                Job Title (optional)
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
            <div className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--runner-text)" }}
              >
                Company (optional)
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
          </div>

          {/* Marketing consent checkbox */}
          {content.marketingConsentEnabled && (
            <div className="flex items-start gap-2 pt-1">
              <div
                className="mt-0.5 size-3.5 shrink-0 rounded border"
                style={{ borderColor: "var(--runner-ghost-border)" }}
              />
              <span
                className="text-[10px] leading-tight"
                style={{ color: "var(--runner-text-muted)" }}
              >
                {content.marketingConsentLabel}
              </span>
            </div>
          )}
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
