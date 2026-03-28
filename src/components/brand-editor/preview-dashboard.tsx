"use client"

/**
 * Dashboard card mockup for the brand editor preview gallery.
 * Renders a sample card with sidebar strip + stats using brand/portal tokens.
 */
export function PreviewDashboard() {
  return (
    <div className="space-y-4">
      <h3
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: "var(--brand-text-muted)" }}
      >
        Dashboard Card
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Mini sidebar strip */}
        <div className="flex">
          <div
            className="w-10 shrink-0 flex flex-col items-center gap-3 py-4"
            style={{ backgroundColor: "var(--brand-600)" }}
          >
            <div className="size-5 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.2)" }} />
            <div className="size-5 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
            <div className="size-5 rounded-md" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
          </div>

          {/* Card content area */}
          <div className="flex-1 p-5 space-y-4">
            {/* Stat row */}
            <div className="flex gap-3">
              {[
                { label: "Active", value: "24", color: "var(--brand-primary)" },
                { label: "Completed", value: "156", color: "var(--brand-accent-500)" },
                { label: "Pending", value: "8", color: "var(--brand-neutral-400)" },
              ].map(({ label, value, color }) => (
                <div
                  key={label}
                  className="flex-1 p-3"
                  style={{
                    borderRadius: "var(--brand-radius-lg)",
                    backgroundColor: "var(--brand-neutral-100)",
                  }}
                >
                  <p
                    className="text-lg font-bold"
                    style={{
                      color,
                      fontFamily: "var(--brand-font-heading)",
                    }}
                  >
                    {value}
                  </p>
                  <p
                    className="text-[11px]"
                    style={{
                      color: "var(--brand-text-muted)",
                      fontFamily: "var(--brand-font-body)",
                    }}
                  >
                    {label}
                  </p>
                </div>
              ))}
            </div>

            {/* Table row mockup */}
            <div className="space-y-2">
              {["Leadership Assessment", "Cognitive Battery", "Culture Fit"].map(
                (name, i) => (
                  <div
                    key={name}
                    className="flex items-center justify-between py-2 px-3"
                    style={{
                      borderRadius: "var(--brand-radius-md)",
                      backgroundColor: i === 0 ? "var(--brand-neutral-100)" : "transparent",
                    }}
                  >
                    <span
                      className="text-[12px] font-medium"
                      style={{
                        color: "var(--brand-text)",
                        fontFamily: "var(--brand-font-body)",
                      }}
                    >
                      {name}
                    </span>
                    <span
                      className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: i === 0 ? "var(--brand-primary)" : "var(--brand-neutral-200)",
                        color: i === 0 ? "var(--brand-primary-foreground)" : "var(--brand-text-muted)",
                        fontFamily: "var(--brand-font-body)",
                      }}
                    >
                      {i === 0 ? "Active" : i === 1 ? "Draft" : "Archived"}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
