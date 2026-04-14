"use client"

import { Check, Clock } from "lucide-react"
import { PreviewShell } from "./preview-shell"
import type { WelcomeContent } from "@/lib/experience/types"

interface PreviewWelcomeProps {
  content: WelcomeContent
  estimatedMinutes?: number
}

export function PreviewWelcome({ content, estimatedMinutes }: PreviewWelcomeProps) {
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
          className="text-sm leading-relaxed"
          style={{ color: "var(--brand-text-muted)" }}
        >
          {content.body}
        </p>

        {/* Info box */}
        <div
          className="rounded-lg p-4 space-y-2"
          style={{
            backgroundColor: "var(--brand-neutral-100)",
            borderRadius: "var(--brand-radius-lg)",
          }}
        >
          <div className="flex items-center justify-between">
            <p
              className="text-xs font-semibold"
              style={{ color: "var(--brand-text)" }}
            >
              {content.infoHeading}
            </p>
            {estimatedMinutes && (
              <span
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "var(--brand-neutral-200)",
                  color: "var(--brand-text-muted)",
                }}
              >
                <Clock className="size-2.5" />
                ~{estimatedMinutes} min
              </span>
            )}
          </div>
          <ul className="space-y-1">
            {content.infoItems.map((item, i) => (
              <li
                key={i}
                className="text-[11px] flex items-start gap-1.5"
                style={{ color: "var(--brand-text-muted)" }}
              >
                <Check
                  className="mt-0.5 size-2.5 shrink-0"
                  style={{ color: "var(--brand-primary)" }}
                />
                {item}
              </li>
            ))}
          </ul>
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
