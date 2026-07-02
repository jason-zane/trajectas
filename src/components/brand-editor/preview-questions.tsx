"use client"

export interface PreviewCardProps {
  brandName?: string
  logoUrl?: string
}

export function PreviewQuestions({ brandName, logoUrl }: PreviewCardProps) {
  const displayName = brandName || "Your Assessment"

  return (
    <div className="space-y-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--runner-text-muted)" }}
      >
        Assessment Questions
      </h3>
      <div
        className="overflow-hidden shadow-md flex flex-col min-h-[400px]"
        style={{
          borderRadius: "10px",
          background: "var(--runner-page)",
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        {/* Hairline progress bar (2px) at top */}
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: "var(--runner-hairline)" }}
        >
          <div
            className="h-full"
            style={{
              width: "35%",
              backgroundColor: "var(--runner-progress)",
              transition: "width 0.3s ease-out",
            }}
          />
        </div>

        {/* Header with branding and back button */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: `1px solid var(--runner-hairline)` }}
        >
          <div className="flex items-center gap-2">
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
          <button
            type="button"
            className="flex items-center gap-1 text-[10px] transition-colors"
            style={{ color: "var(--runner-text-muted)" }}
          >
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* Question content area */}
        <div className="flex-1 px-8 py-8 space-y-6">
          {/* Eyebrow label */}
          <p
            className="text-[0.75rem] font-semibold uppercase tracking-[0.16em]"
            style={{
              color: "var(--runner-overline)",
              fontFamily: '"Geist Mono", monospace',
              letterSpacing: "0.16em",
            }}
          >
            {displayName}
          </p>

          {/* Question text */}
          <div>
            <p
              className="text-lg leading-relaxed"
              style={{
                color: "var(--runner-display)",
                fontFamily: '"Source Serif 4", Georgia, serif',
                fontWeight: 600,
              }}
            >
              I naturally take charge when a team lacks direction.
            </p>
          </div>

          {/* Likert options (ghost buttons, 5-column grid) */}
          <div className="grid grid-cols-5 gap-2">
            {[
              "SD",
              "D",
              "N",
              "A",
              "SA",
            ].map((optionLabel, i) => {
              const isSelected = i === 3
              return (
                <button
                  key={optionLabel}
                  type="button"
                  className="py-3 px-2 text-[11px] font-medium text-center transition-all duration-150"
                  style={{
                    borderRadius: "8px",
                    border: "1px solid",
                    borderColor: isSelected
                      ? "var(--runner-selected-fill)"
                      : "var(--runner-ghost-border)",
                    backgroundColor: isSelected
                      ? "var(--runner-selected-fill)"
                      : "var(--runner-ghost-fill)",
                    color: isSelected
                      ? "var(--runner-selected-text)"
                      : "var(--runner-text)",
                    fontWeight: isSelected ? "600" : "500",
                    boxShadow: isSelected ? "var(--runner-selected-shadow)" : "none",
                  }}
                >
                  {optionLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer with save status */}
        <div
          className="flex items-center justify-center gap-1.5 px-6 py-3"
          style={{
            borderTop: `1px solid var(--runner-hairline)`,
            color: "var(--runner-text-muted)",
            fontSize: "0.6875rem",
          }}
        >
          <span
            className="inline-block size-1.5 rounded-full"
            style={{ backgroundColor: "var(--runner-save-dot)" }}
          />
          <span>Saved a moment ago</span>
        </div>
      </div>
    </div>
  )
}
