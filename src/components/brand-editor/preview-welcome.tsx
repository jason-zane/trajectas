"use client"

import type { PreviewCardProps } from "./preview-questions"

/**
 * Assessment welcome / intro page mockup for the brand editor preview gallery.
 * Shows the branded header with logo area, welcome heading, and begin button.
 */
export function PreviewWelcome({ brandName, logoUrl }: PreviewCardProps) {
  const displayName = brandName || "Your Assessment"
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-text-muted)" }}>
        Welcome Page
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Header with logo area */}
        <div
          className="flex items-center gap-2.5 px-6 py-4"
          style={{ borderBottom: "1px solid var(--brand-neutral-200)" }}
        >
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl}
              alt={displayName}
              className="h-5 w-auto object-contain"
            />
          ) : (
            <div
              className="flex size-7 items-center justify-center"
              style={{
                borderRadius: "var(--brand-radius-md)",
                backgroundColor: "var(--brand-surface)",
              }}
            >
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ color: "var(--brand-primary)" }}
              >
                <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
          )}
          <span
            className="text-sm font-semibold tracking-tight"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            {displayName}
          </span>
        </div>

        {/* Welcome content */}
        <div className="px-6 py-8 text-center space-y-4">
          <div className="flex justify-center">
            <div
              className="flex size-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--brand-surface)" }}
            >
              <svg
                className="size-7"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ color: "var(--brand-primary)" }}
              >
                <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="10" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <h2
              className="text-lg font-semibold tracking-tight"
              style={{
                color: "var(--brand-text)",
                fontFamily: "var(--brand-font-heading)",
              }}
            >
              Welcome, Alex
            </h2>
            <p
              className="text-xs leading-relaxed max-w-[260px] mx-auto"
              style={{ color: "var(--brand-text-muted)" }}
            >
              You&apos;ve been invited to complete the Leadership Assessment. This should take approximately 15 minutes.
            </p>
          </div>

          {/* Begin button */}
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-medium transition-all"
            style={{
              borderRadius: "var(--brand-radius-lg)",
              backgroundColor: "var(--brand-primary)",
              color: "var(--brand-primary-foreground)",
            }}
          >
            Begin Assessment
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center px-6 py-3"
          style={{
            borderTop: "1px solid var(--brand-neutral-200)",
            color: "var(--brand-text-muted)",
          }}
        >
          <span
            className="text-[11px]"
            style={{ fontFamily: "var(--brand-font-body)" }}
          >
            Powered by Trajectas
          </span>
        </div>
      </div>
    </div>
  )
}
