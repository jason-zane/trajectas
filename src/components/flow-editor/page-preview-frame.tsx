"use client"

import { useState, useMemo } from "react"
import { Play } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens"
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults"
import { Button } from "@/components/ui/button"
import {
  PreviewJoin,
  PreviewWelcome,
  PreviewConsent,
  PreviewDemographics,
  PreviewReview,
  PreviewComplete,
  PreviewReport,
  PreviewExpired,
  PreviewCustom,
} from "./previews"
import type { BrandConfig } from "@/lib/brand/types"
import type {
  ExperiencePageType,
  PageContentMap,
  FlowConfig,
  CustomPageContent,
} from "@/lib/experience/types"

type PreviewMode = "light" | "dark" | "mobile"

interface PagePreviewFrameProps {
  pageId: string
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  customPageContent: Record<string, CustomPageContent>
  brandConfig?: BrandConfig | null
  onPreviewFlow: () => void
}

const BUILT_IN_PAGES = new Set([
  "join", "welcome", "consent", "demographics",
  "section_intro", "review", "complete", "report", "expired",
])

export function PagePreviewFrame({
  pageId,
  pageContent,
  flowConfig,
  customPageContent,
  brandConfig,
  onPreviewFlow,
}: PagePreviewFrameProps) {
  const [mode, setMode] = useState<PreviewMode>("light")

  const { lightStyles, darkStyles } = useMemo(() => {
    if (!brandConfig) return { lightStyles: {}, darkStyles: {} }
    const { tokens } = generateCSSTokens(brandConfig)
    const darkCss = generateDarkCSSTokens(brandConfig)

    const light: Record<string, string> = {}
    for (const [key, val] of Object.entries(tokens)) {
      light[key] = val
    }

    const dark: Record<string, string> = {}
    const matches = darkCss.matchAll(/\s*(--[\w-]+):\s*(.+);/g)
    for (const match of matches) {
      dark[match[1]] = match[2]
    }

    return { lightStyles: light, darkStyles: dark }
  }, [brandConfig])

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

  function renderPreview() {
    const isCustom = !BUILT_IN_PAGES.has(pageId)
    if (isCustom) {
      const content = customPageContent[pageId] ?? {
        heading: "Custom Page",
        body: "Page content goes here.",
        buttonLabel: "Continue",
      }
      return <PreviewCustom content={content} />
    }

    const page = pageId as ExperiencePageType
    const defaults = DEFAULT_PAGE_CONTENT as PageContentMap
    switch (page) {
      case "join":
        return <PreviewJoin content={{ ...defaults.join, ...pageContent.join }} />
      case "welcome":
        return <PreviewWelcome content={{ ...defaults.welcome, ...pageContent.welcome }} />
      case "consent":
        return <PreviewConsent content={{ ...defaults.consent, ...pageContent.consent }} />
      case "demographics":
        return <PreviewDemographics content={{ ...defaults.demographics, ...pageContent.demographics }} />
      case "review":
        return <PreviewReview content={{ ...defaults.review, ...pageContent.review }} />
      case "complete":
        return <PreviewComplete content={{ ...defaults.complete, ...pageContent.complete }} />
      case "report": {
        const reportMode = (flowConfig.report as { reportMode?: string })?.reportMode ?? "holding"
        return (
          <PreviewReport
            content={{
              ...defaults.report,
              ...pageContent.report,
              reportMode: reportMode as "holding" | "view_results",
            }}
          />
        )
      }
      case "expired":
        return <PreviewExpired content={{ ...defaults.expired, ...pageContent.expired }} />
      default:
        return (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
            No preview available
          </div>
        )
    }
  }

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Mode toggle + Preview Flow button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
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

        <Button variant="outline" size="sm" onClick={onPreviewFlow} className="gap-1.5">
          <Play className="size-3" />
          Preview Flow
        </Button>
      </div>

      {/* Phone frame */}
      <div
        className={cn(
          "flex-1 overflow-y-auto rounded-2xl border transition-all duration-300",
          isDark
            ? "border-white/10 bg-[#0d0d0d]"
            : "border-border/50 bg-muted/20",
          isMobile && "mx-auto max-w-[375px]",
        )}
        style={{
          ...combinedStyles,
          fontFamily: "var(--brand-font-body)",
        }}
      >
        <div className="p-3">
          {renderPreview()}
        </div>
      </div>
    </div>
  )
}
