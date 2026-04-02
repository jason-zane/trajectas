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
        style={{ color: "var(--brand-text-muted)" }}
      >
        Assessment Questions
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Header with logo/name */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--brand-neutral-200)" }}
        >
          <div className="flex items-center gap-2">
            {logoUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={logoUrl}
                alt={displayName}
                className="h-5 w-auto object-contain"
              />
            ) : (
              <div
                className="flex size-6 items-center justify-center"
                style={{
                  borderRadius: "var(--brand-radius-md)",
                  backgroundColor: "var(--brand-surface)",
                }}
              >
                <svg
                  className="size-3.5"
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
              className="text-xs font-semibold tracking-tight"
              style={{
                color: "var(--brand-text)",
                fontFamily: "var(--brand-font-heading)",
              }}
            >
              {displayName}
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-[10px]"
            style={{ color: "var(--brand-text-muted)" }}
          >
            <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        {/* Progress bar */}
        <div
          className="h-0.5 w-full"
          style={{ backgroundColor: "var(--brand-neutral-200)" }}
        >
          <div
            className="h-full w-[35%] transition-all duration-500"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        {/* Question content */}
        <div className="px-6 pt-5 pb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--brand-primary)" }}
          >
            {displayName}
          </p>
        </div>
        <div className="px-6 pb-3">
          <p
            className="text-base font-medium leading-relaxed"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            I naturally take charge when a team lacks direction.
          </p>
        </div>

        {/* Likert options */}
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            {[
              "Strongly Disagree",
              "Disagree",
              "Neutral",
              "Agree",
              "Strongly Agree",
            ].map((optionLabel, i) => {
              const isSelected = i === 3
              return (
                <button
                  key={optionLabel}
                  type="button"
                  className="flex-1 py-2.5 px-1 text-[11px] font-medium text-center transition-all duration-200"
                  style={{
                    borderRadius: "var(--brand-radius-lg)",
                    backgroundColor: isSelected
                      ? "var(--brand-primary)"
                      : "var(--brand-neutral-100)",
                    color: isSelected
                      ? "var(--brand-primary-foreground)"
                      : "var(--brand-text-muted)",
                    border: isSelected
                      ? "1px solid transparent"
                      : "1px solid var(--brand-neutral-200)",
                  }}
                >
                  {optionLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-center gap-1.5 px-6 py-3"
          style={{
            borderTop: "1px solid var(--brand-neutral-200)",
            color: "var(--brand-text-muted)",
          }}
        >
          <span
            className="inline-block size-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
          <span
            className="text-[11px]"
            style={{ fontFamily: "var(--brand-font-body)" }}
          >
            Responses saved automatically
          </span>
        </div>
      </div>
    </div>
  )
}
