"use client"

/**
 * Email invitation mockup for the brand editor preview gallery.
 * Renders a branded email template layout using CSS variables.
 */
export function PreviewEmail() {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--brand-text-muted)" }}>
        Email Invitation
      </h3>
      <div
        className="overflow-hidden shadow-md"
        style={{
          borderRadius: "var(--brand-radius-xl)",
          backgroundColor: "var(--brand-neutral-50)",
        }}
      >
        {/* Header bar */}
        <div
          className="px-8 py-5"
          style={{
            backgroundColor: "var(--brand-primary)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className="size-6 rounded-md"
              style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
            />
            <span
              className="text-sm font-semibold text-white"
              style={{ fontFamily: "var(--brand-font-heading)" }}
            >
              Trajectas
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-4">
          <p
            className="text-sm font-semibold"
            style={{
              color: "var(--brand-text)",
              fontFamily: "var(--brand-font-heading)",
            }}
          >
            You&apos;re invited to complete an assessment
          </p>
          <p
            className="text-[13px] leading-relaxed"
            style={{
              color: "var(--brand-text-muted)",
              fontFamily: "var(--brand-font-body)",
            }}
          >
            Hi Alex, you have been invited to complete the{" "}
            <strong style={{ color: "var(--brand-text)" }}>
              Leadership Competency Assessment
            </strong>{" "}
            for Acme Corp. This assessment typically takes 20-30 minutes.
          </p>
          <p
            className="text-[13px] leading-relaxed"
            style={{
              color: "var(--brand-text-muted)",
              fontFamily: "var(--brand-font-body)",
            }}
          >
            Please find a quiet environment where you can focus without
            interruption. There are no right or wrong answers.
          </p>

          {/* CTA button */}
          <div className="pt-2">
            <span
              className="inline-block px-6 py-2.5 text-sm font-medium text-white"
              style={{
                backgroundColor: "var(--brand-primary)",
                borderRadius: "var(--brand-radius-lg)",
                fontFamily: "var(--brand-font-body)",
              }}
            >
              Begin assessment
            </span>
          </div>

          <p
            className="text-[12px]"
            style={{
              color: "var(--brand-text-muted)",
              fontFamily: "var(--brand-font-body)",
            }}
          >
            This link expires in 7 days. If you have questions, contact your HR
            representative.
          </p>
        </div>

        {/* Footer */}
        <div
          className="px-8 py-4 text-center"
          style={{
            borderTop: "1px solid var(--brand-neutral-200)",
          }}
        >
          <p
            className="text-[11px]"
            style={{
              color: "var(--brand-text-muted)",
              fontFamily: "var(--brand-font-body)",
            }}
          >
            Powered by Trajectas | Assessment Platform
          </p>
        </div>
      </div>
    </div>
  )
}
