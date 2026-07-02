"use client"

import { Check } from "lucide-react"
import { PreviewShell } from "./preview-shell"
import type { WelcomeContent } from "@/lib/experience/types"

interface PreviewWelcomeProps {
  content: WelcomeContent
  estimatedMinutes?: number
}

export function PreviewWelcome({ content, estimatedMinutes }: PreviewWelcomeProps) {
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
            className="text-sm leading-relaxed"
            style={{ color: "var(--runner-text-muted)" }}
          >
            {content.body}
          </p>
        </div>

        {/* Info box */}
        <div
          className="rounded-lg p-4 space-y-3"
          style={{
            backgroundColor: "var(--runner-ghost-fill)",
            borderRadius: "8px",
            border: `1px solid var(--runner-hairline)`,
          }}
        >
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--runner-text)" }}
            >
              {content.infoHeading}
            </p>
            {estimatedMinutes && (
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full"
                style={{
                  backgroundColor: "var(--runner-ghost-border)",
                  color: "var(--runner-text-muted)",
                  fontFamily: '"Geist Mono", monospace',
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {estimatedMinutes}% COMPLETE
              </span>
            )}
          </div>
          <ul className="space-y-1.5">
            {content.infoItems.map((item, i) => (
              <li
                key={i}
                className="text-[11px] flex items-start gap-1.5"
                style={{ color: "var(--runner-text-muted)" }}
              >
                <Check
                  className="mt-0.5 size-2.5 shrink-0"
                  style={{ color: "var(--runner-accent)" }}
                />
                {item}
              </li>
            ))}
          </ul>
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
