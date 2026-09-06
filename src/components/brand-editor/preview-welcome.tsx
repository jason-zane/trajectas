"use client"

import { BrandFooter } from "@/components/brand/brand-logo";

import type { PreviewCardProps } from "./preview-questions"

/**
 * Assessment welcome / intro page mockup for the brand editor preview gallery.
 * Dark-editorial runner design with ink/paper surfaces.
 */
export function PreviewWelcome({ brandName, logoUrl }: PreviewCardProps) {
  const displayName = brandName || "Your Assessment"
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--runner-text-muted)" }}>
        Welcome Page
      </h3>
      <div
        className="overflow-hidden shadow-md flex flex-col min-h-[320px]"
        style={{
          borderRadius: "10px",
          background: "var(--runner-page)",
          fontFamily: '"Source Serif 4", Georgia, serif',
        }}
      >
        {/* Hairline progress bar (2px) */}
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: "var(--runner-hairline)" }}
        >
          <div
            className="h-full"
            style={{
              width: "0%",
              backgroundColor: "var(--runner-progress)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>

        {/* Header with branding */}
        <div
          className="flex items-center gap-2.5 px-6 py-4"
          style={{ borderBottom: `1px solid var(--runner-hairline)` }}
        >
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={displayName}
              className="h-5 w-auto object-contain"
              style={{ filter: "brightness(0.95)" }}
            />
          ) : (
            <div
              className="flex size-6 items-center justify-center rounded"
              style={{
                backgroundColor: "var(--runner-accent)",
                color: "var(--runner-ink)",
              }}
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
              </svg>
            </div>
          )}
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              color: "var(--runner-text)",
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontWeight: 600,
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Welcome content */}
        <div className="flex-1 px-8 py-12 flex flex-col items-center justify-center text-center space-y-6">
          {/* Eyebrow label */}
          <p
            className="text-[0.75rem] font-semibold uppercase tracking-[0.16em]"
            style={{
              color: "var(--runner-overline)",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.16em",
            }}
          >
            Assessment Invitation
          </p>

          {/* Heading */}
          <div className="space-y-3">
            <h2
              className="text-2xl font-semibold leading-tight"
              style={{
                color: "var(--runner-display)",
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
              }}
            >
              Welcome
            </h2>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: "var(--runner-text-muted)" }}
            >
              Complete this assessment to unlock your personalized insights. Approximately 15 minutes.
            </p>
          </div>

          {/* Begin button (CTA style) */}
          <button
            type="button"
            className="inline-flex items-center gap-2 px-8 py-3 text-sm font-medium transition-all duration-150"
            style={{
              borderRadius: "8px",
              backgroundColor: "var(--runner-cta-fill)",
              color: "var(--runner-cta-text)",
            }}
          >
            Begin assessment
          </button>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center px-6 py-3 text-center"
          style={{
            borderTop: `1px solid var(--runner-hairline)`,
            color: "var(--runner-text-meta)",
            fontSize: "0.6875rem",
          }}
        >
          <BrandFooter text="Powered by Trajectas" runner />
        </div>
      </div>
    </div>
  )
}
