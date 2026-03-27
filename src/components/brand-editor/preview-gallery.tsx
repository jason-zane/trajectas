"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens"
import type { BrandConfig } from "@/lib/brand/types"
import { PreviewRunner } from "./preview-runner"
import { PreviewReport } from "./preview-report"
import { PreviewEmail } from "./preview-email"

type PreviewMode = "light" | "dark" | "mobile"

interface PreviewGalleryProps {
  config: BrandConfig
  /** If true, only shows the runner preview (used for client editor). */
  compact?: boolean
}

export function PreviewGallery({ config, compact = false }: PreviewGalleryProps) {
  const [mode, setMode] = useState<PreviewMode>("light")

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

  return (
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
          <PreviewRunner />
          {!compact && (
            <>
              <PreviewReport />
              <PreviewEmail />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
