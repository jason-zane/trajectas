"use client"

interface PreviewShellProps {
  brandName?: string
  children: React.ReactNode
  footerText?: string
}

/**
 * Shared shell for flow page previews — header bar, content slot, footer.
 * Uses --brand-* CSS variables from parent container.
 */
export function PreviewShell({ brandName = "Talent Fit", children, footerText }: PreviewShellProps) {
  return (
    <div
      className="flex flex-col min-h-[400px] overflow-hidden"
      style={{
        borderRadius: "var(--brand-radius-xl)",
        backgroundColor: "var(--brand-neutral-50)",
        fontFamily: "var(--brand-font-body)",
      }}
    >
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{
          borderBottom: "1px solid var(--brand-neutral-200)",
        }}
      >
        <div
          className="size-5 rounded-md"
          style={{ backgroundColor: "var(--brand-primary)" }}
        />
        <span
          className="text-xs font-semibold"
          style={{
            color: "var(--brand-text)",
            fontFamily: "var(--brand-font-heading)",
          }}
        >
          {brandName}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-6">
        {children}
      </div>

      {/* Footer */}
      {footerText && (
        <div
          className="px-5 py-3 text-center"
          style={{
            borderTop: "1px solid var(--brand-neutral-200)",
            color: "var(--brand-text-muted)",
          }}
        >
          <span className="text-[10px]">{footerText}</span>
        </div>
      )}
    </div>
  )
}
