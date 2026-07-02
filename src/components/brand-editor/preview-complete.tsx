"use client"

import type { PreviewCardProps } from "./preview-questions"

export function PreviewComplete({ brandName, logoUrl }: PreviewCardProps) {
  const displayName = brandName || "Your Assessment"

  return (
    <div className="space-y-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--runner-text-muted)" }}
      >
        Completion Page
      </h3>
      <div
        className="overflow-hidden shadow-md flex flex-col min-h-[360px]"
        style={{
          borderRadius: "10px",
          background: "var(--runner-page)",
          fontFamily: '"Source Serif 4", Georgia, serif',
        }}
      >
        {/* Hairline progress bar (100% complete) */}
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: "var(--runner-hairline)" }}
        >
          <div
            className="h-full w-full"
            style={{
              backgroundColor: "var(--runner-progress)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>

        {/* Header with branding */}
        <div
          className="flex items-center gap-2 px-6 py-4"
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
                className="size-3.5"
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

        {/* Completion content */}
        <div className="flex-1 px-8 py-12 flex flex-col items-center justify-center text-center space-y-6">
          {/* Checkmark icon */}
          <div
            className="flex size-16 items-center justify-center rounded-full"
            style={{
              backgroundColor: "var(--runner-accent)",
              color: "var(--runner-ink)",
            }}
          >
            <svg
              className="size-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>

          {/* Heading and message */}
          <div className="space-y-3">
            <h2
              className="text-2xl font-semibold"
              style={{
                color: "var(--runner-display)",
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
              }}
            >
              Thank You
            </h2>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: "var(--runner-text-muted)" }}
            >
              Your responses have been recorded. Your results will be shared shortly.
            </p>
          </div>
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
          <span>Powered by Trajectas</span>
        </div>
      </div>
    </div>
  )
}
