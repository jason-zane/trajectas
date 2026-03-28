"use client"

import { useState, useMemo } from "react"
import { Expand, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens"
import type { BrandConfig } from "@/lib/brand/types"
import { PreviewRunner } from "./preview-runner"
import { PreviewReport } from "./preview-report"
import { PreviewEmail } from "./preview-email"
import { PreviewDashboard } from "./preview-dashboard"

type PreviewMode = "light" | "dark" | "mobile"

interface PreviewGalleryProps {
  config: BrandConfig
  /** If true, only shows the runner preview (used for client editor). */
  compact?: boolean
}

type PreviewSurface = "runner" | "report" | "email" | "dashboard"

const SURFACE_LABELS: Record<PreviewSurface, string> = {
  runner: "Assessment Runner",
  report: "Report Cover",
  email: "Email Invitation",
  dashboard: "Dashboard Card",
}

const SURFACE_COMPONENTS: Record<PreviewSurface, React.FC> = {
  runner: PreviewRunner,
  report: PreviewReport,
  email: PreviewEmail,
  dashboard: PreviewDashboard,
}

export function PreviewGallery({ config, compact = false }: PreviewGalleryProps) {
  const [mode, setMode] = useState<PreviewMode>("light")
  const [fullScreenSurface, setFullScreenSurface] = useState<PreviewSurface | null>(null)

  // Generate CSS tokens as inline style object
  const { lightStyles, darkCss } = useMemo(() => {
    const { tokens } = generateCSSTokens(config)
    const darkCssStr = generateDarkCSSTokens(config)

    // Convert token map to React style object
    const styleObj: Record<string, string> = {}
    for (const [key, val] of Object.entries(tokens)) {
      styleObj[key] = val
    }

    return { lightStyles: styleObj, darkCss: darkCssStr }
  }, [config])

  // For dark mode, parse the dark tokens into a style object
  const darkStyles = useMemo(() => {
    const styleObj: Record<string, string> = {}
    // Parse the dark CSS string to extract variable declarations
    const matches = darkCss.matchAll(/\s*(--[\w-]+):\s*(.+);/g)
    for (const match of matches) {
      styleObj[match[1]] = match[2]
    }
    return styleObj
  }, [darkCss])

  const isDark = mode === "dark"
  const isMobile = mode === "mobile"

  const combinedStyles = isDark
    ? { ...lightStyles, ...darkStyles }
    : lightStyles

  const modes: { value: PreviewMode; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "mobile", label: "Mobile" },
  ]

  const FullScreenComponent = fullScreenSurface
    ? SURFACE_COMPONENTS[fullScreenSurface]
    : null

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Mode toggle bar */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1 self-start">
          {modes.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                mode === m.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Preview container */}
        <div
          className={cn(
            "overflow-y-auto rounded-xl border p-6 transition-all duration-300",
            isDark
              ? "border-white/10 bg-[#0d0d0d]"
              : "border-border/50 bg-muted/20",
            isMobile && "mx-auto max-w-[375px]"
          )}
          style={{
            ...combinedStyles,
            maxHeight: "calc(100vh - 200px)",
            fontFamily: "var(--brand-font-body)",
          }}
        >
          <div className="space-y-8">
            {/* Each preview has an expand button */}
            <PreviewCard surface="dashboard" onExpand={setFullScreenSurface}>
              <PreviewDashboard />
            </PreviewCard>
            <PreviewCard surface="runner" onExpand={setFullScreenSurface}>
              <PreviewRunner />
            </PreviewCard>
            {!compact && (
              <>
                <PreviewCard surface="report" onExpand={setFullScreenSurface}>
                  <PreviewReport />
                </PreviewCard>
                <PreviewCard surface="email" onExpand={setFullScreenSurface}>
                  <PreviewEmail />
                </PreviewCard>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Full-page preview dialog */}
      {fullScreenSurface && FullScreenComponent && (
        <div className="fixed inset-0 z-50 flex flex-col">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFullScreenSurface(null)} />
          <div className="relative z-10 flex flex-col h-full">
            {/* Header bar */}
            <div className="flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur border-b">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{SURFACE_LABELS[fullScreenSurface]}</span>
                <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
                  {modes.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMode(m.value)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200",
                        mode === m.value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFullScreenSurface(null)}
                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <X className="size-3.5" />
                Close
              </button>
            </div>

            {/* Full-size preview */}
            <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
              <div
                className={cn(
                  "w-full max-w-2xl rounded-2xl border p-8 shadow-xl transition-all duration-300",
                  isDark
                    ? "border-white/10 bg-[#0d0d0d]"
                    : "border-border/50 bg-white",
                  isMobile && "max-w-[375px]"
                )}
                style={{
                  ...combinedStyles,
                  fontFamily: "var(--brand-font-body)",
                }}
              >
                <FullScreenComponent />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Wrapper that adds an expand button to each preview section. */
function PreviewCard({
  surface,
  onExpand,
  children,
}: {
  surface: PreviewSurface
  onExpand: (s: PreviewSurface) => void
  children: React.ReactNode
}) {
  return (
    <div className="group/preview relative">
      <button
        type="button"
        onClick={() => onExpand(surface)}
        className="absolute top-0 right-0 z-10 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium opacity-0 transition-opacity group-hover/preview:opacity-100"
        style={{ color: "var(--brand-text-muted)" }}
        title={`View ${SURFACE_LABELS[surface]} full size`}
      >
        <Expand className="size-3" />
        Expand
      </button>
      {children}
    </div>
  )
}
