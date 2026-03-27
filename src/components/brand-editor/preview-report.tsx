"use client"

/**
 * Report cover mockup for the brand editor preview gallery.
 * Displays a gradient header using brand colors + structured metadata.
 */
export function PreviewReport() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-text-muted)" }}>
        Report Cover
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Gradient header */}
        <div
          className="relative px-8 py-10"
          style={{
            background: `linear-gradient(135deg, var(--brand-700), var(--brand-600), var(--brand-500))`,
          }}
        >
          {/* Logo placeholder */}
          <div
            className="mb-8 inline-flex items-center gap-2 rounded-md px-3 py-1.5"
            style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
          >
            <div className="size-5 rounded-sm" style={{ backgroundColor: "rgba(255,255,255,0.5)" }} />
            <span
              className="text-sm font-semibold text-white/90"
              style={{ fontFamily: "var(--brand-font-heading)" }}
            >
              TalentFit
            </span>
          </div>

          <p
            className="text-xs font-medium uppercase tracking-[0.2em] text-white/60"
            style={{ fontFamily: "var(--brand-font-body)" }}
          >
            Assessment Report
          </p>
          <h2
            className="mt-2 text-xl font-bold text-white"
            style={{ fontFamily: "var(--brand-font-heading)" }}
          >
            Leadership Competency Profile
          </h2>
        </div>

        {/* Meta section */}
        <div className="px-8 py-6 space-y-4">
          {[
            { label: "Candidate", value: "Alex Morgan" },
            { label: "Assessment", value: "Senior Leadership Suite" },
            { label: "Date", value: "28 March 2026" },
            { label: "Organisation", value: "Acme Corp" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-baseline justify-between">
              <span
                className="text-xs font-medium uppercase tracking-wider"
                style={{
                  color: "var(--brand-text-muted)",
                  fontFamily: "var(--brand-font-body)",
                }}
              >
                {label}
              </span>
              <span
                className="text-sm font-medium"
                style={{
                  color: "var(--brand-text)",
                  fontFamily: "var(--brand-font-body)",
                }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="mx-8" style={{ borderTop: "1px solid var(--brand-neutral-200)" }} />

        {/* Confidential notice */}
        <div className="px-8 py-4">
          <p
            className="text-[11px]"
            style={{
              color: "var(--brand-text-muted)",
              fontFamily: "var(--brand-font-body)",
            }}
          >
            Confidential - For authorised recipients only
          </p>
        </div>
      </div>
    </div>
  )
}
