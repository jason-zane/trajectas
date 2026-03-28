"use client"

import { PreviewShell } from "./preview-shell"
import type { WelcomeContent } from "@/lib/experience/types"

interface PreviewWelcomeProps {
  content: WelcomeContent
}

export function PreviewWelcome({ content }: PreviewWelcomeProps) {
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
          <p
            className="text-xs font-semibold"
            style={{ color: "var(--brand-text)" }}
          >
            {content.infoHeading}
          </p>
          <ul className="space-y-1">
            {content.infoItems.slice(0, 3).map((item, i) => (
              <li
                key={i}
                className="text-[11px] flex items-start gap-1.5"
                style={{ color: "var(--brand-text-muted)" }}
              >
                <span
                  className="mt-1.5 inline-block size-1 rounded-full shrink-0"
                  style={{ backgroundColor: "var(--brand-primary)" }}
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
