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

        {/* Mock form card */}
        <div
          className="rounded-xl border p-4 space-y-3"
          style={{
            borderColor: "var(--brand-neutral-200)",
            backgroundColor: "var(--brand-neutral-50)",
          }}
        >
          {/* Email field */}
          <div className="space-y-1">
            <span
              className="text-[10px] font-medium"
              style={{ color: "var(--brand-text)" }}
            >
              Email
            </span>
            <div
              className="h-8 rounded-md px-2 flex items-center"
              style={{
                backgroundColor: "var(--brand-neutral-100)",
                border: "1px solid var(--brand-neutral-200)",
                borderRadius: "var(--brand-radius-md)",
              }}
            >
              <span
                className="text-[10px]"
                style={{ color: "var(--brand-text-muted)" }}
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
                style={{ color: "var(--brand-text)" }}
              >
                First Name
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
            <div className="space-y-1">
              <span
                className="text-[10px] font-medium"
                style={{ color: "var(--brand-text)" }}
              >
                Last Name
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
          </div>

          {/* Marketing consent checkbox */}
          {content.marketingConsentEnabled && (
            <div className="flex items-start gap-2 pt-1">
              <div
                className="mt-0.5 size-3.5 shrink-0 rounded-sm border"
                style={{ borderColor: "var(--brand-neutral-300)" }}
              />
              <span
                className="text-[10px] leading-tight"
                style={{ color: "var(--brand-text-muted)" }}
              >
                {content.marketingConsentLabel}
              </span>
            </div>
          )}
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
