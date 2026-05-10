"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { generateCSSTokens } from "@/lib/brand/tokens"
import { buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults"
import {
  PreviewJoin,
  PreviewWelcome,
  PreviewConsent,
  PreviewDemographics,
  PreviewRunner,
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

type PreviewMode = "light" | "mobile"

interface PagePreviewFrameProps {
  pageId: string
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  customPageContent: Record<string, CustomPageContent>
  brandConfig?: BrandConfig | null
}

const BUILT_IN_PAGES = new Set([
  "join", "welcome", "consent", "demographics",
  "runner", "review", "complete", "report", "expired",
])

export function PagePreviewFrame({
  pageId,
  pageContent,
  flowConfig,
  customPageContent,
  brandConfig,
}: PagePreviewFrameProps) {
  const [mode, setMode] = useState<PreviewMode>("light")

  const lightStyles = useMemo(() => {
    if (!brandConfig) return {}
    const { tokens } = generateCSSTokens(brandConfig)
    const light: Record<string, string> = {}
    for (const [key, val] of Object.entries(tokens)) {
      light[key] = val
    }
    return light
  }, [brandConfig])

  const fontsUrl = useMemo(() => {
    if (!brandConfig) return null
    return buildGoogleFontsUrl([
      brandConfig.headingFont,
      brandConfig.bodyFont,
      brandConfig.monoFont,
    ])
  }, [brandConfig])

  const isMobile = mode === "mobile"
  const combinedStyles = lightStyles

  const modes: { value: PreviewMode; label: string }[] = [
    { value: "light", label: "Light" },
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
      case "runner":
        return <PreviewRunner content={{ ...defaults.runner, ...pageContent.runner }} />
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
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} /> }
      {/* Mode toggle */}
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

      {/* Phone frame */}
      <div
        className={cn(
          "flex-1 overflow-y-auto rounded-2xl border transition-all duration-300 border-border/50 bg-muted/20",
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
