"use client"

/**
 * Assessment runner card mockup for the brand editor preview gallery.
 * Renders a sample Likert question with horizontal options that pick up
 * brand CSS variables from the parent container.
 */
export function PreviewRunner() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-text-muted)" }}>
        Assessment Runner
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Progress bar */}
        <div className="h-0.5 w-full" style={{ backgroundColor: "var(--brand-neutral-200)" }}>
          <div
            className="h-full w-[35%] transition-all duration-500"
            style={{ backgroundColor: "var(--brand-primary)" }}
          />
        </div>

        {/* Header */}
        <div className="px-6 pt-5 pb-2">
          <p
            className="text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--brand-primary)" }}
          >
            Leadership Assessment
          </p>
        </div>

        {/* Question */}
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

        {/* Likert options — horizontal */}
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            {[
              "Strongly Disagree",
              "Disagree",
              "Neutral",
              "Agree",
              "Strongly Agree",
            ].map((label, i) => {
              const isSelected = i === 3
              return (
                <button
                  key={label}
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
                  {label}
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
