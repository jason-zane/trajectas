"use client"

import { BrandLogo, BrandFooter } from "@/components/brand/brand-logo";

interface PreviewShellProps {
  brandName?: string
  children: React.ReactNode
  footerText?: string
}

/**
 * Shared shell for flow page previews — header bar, content slot, footer.
 * Uses --runner-* CSS variables for dark-editorial runner design.
 */
export function PreviewShell({ brandName = "Trajectas", children, footerText }: PreviewShellProps) {
  return (
    <div
      className="flex flex-col min-h-[400px] overflow-hidden"
      style={{
        borderRadius: "10px",
        background: "var(--runner-page)",
        fontFamily: '"Plus Jakarta Sans", sans-serif',
      }}
    >
      {/* Hairline progress bar */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: "var(--runner-hairline)" }}
      />

      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-6 py-4"
        style={{
          borderBottom: `1px solid var(--runner-hairline)`,
        }}
      >
        <BrandLogo name={brandName} runner height={26} />
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-6">
        {children}
      </div>

      {/* Footer */}
      {footerText && (
        <div
          className="px-6 py-3 text-center"
          style={{
            borderTop: `1px solid var(--runner-hairline)`,
            color: "var(--runner-text-meta)",
            fontSize: "0.6875rem",
          }}
        >
          <span><BrandFooter text={footerText} runner /></span>
        </div>
      )}
    </div>
  )
}
