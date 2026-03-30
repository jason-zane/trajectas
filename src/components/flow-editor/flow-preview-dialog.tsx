"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens"
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults"
import { buildPageList } from "./flow-sidebar"
import {
  PreviewJoin,
  PreviewWelcome,
  PreviewConsent,
  PreviewDemographics,
  PreviewSectionIntro,
  PreviewRunner,
  PreviewReview,
  PreviewComplete,
  PreviewReport,
  PreviewExpired,
  PreviewCustom,
} from "./previews"
import type { BrandConfig } from "@/lib/brand/types"
import type {
  PageContentMap,
  FlowConfig,
  ExperiencePageType,
  CustomPageContent,
} from "@/lib/experience/types"

type PreviewMode = "light" | "dark" | "mobile"

interface FlowPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  customPageContent: Record<string, CustomPageContent>
  brandConfig?: BrandConfig | null
}

const BUILT_IN_PAGES = new Set([
  "join", "welcome", "consent", "demographics",
  "section_intro", "runner", "review", "complete", "report", "expired",
])

export function FlowPreviewDialog({
  open,
  onOpenChange,
  pageContent,
  flowConfig,
  customPageContent,
  brandConfig,
}: FlowPreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<PreviewMode>("light")

  // Build enabled flow order
  const enabledPages = useMemo(() => {
    const all = buildPageList(flowConfig)
    return all.filter((p) => p.enabled)
  }, [flowConfig])

  const currentPage = enabledPages[currentIndex]

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!open) return
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        setCurrentIndex((i) => Math.max(0, i - 1))
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        setCurrentIndex((i) => Math.min(enabledPages.length - 1, i + 1))
      }
      if (e.key === "Escape") {
        onOpenChange(false)
      }
    },
    [open, enabledPages.length, onOpenChange]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

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

  function renderPreview(pageId: string) {
    const isCustom = !BUILT_IN_PAGES.has(pageId)
    if (isCustom) {
      const content = customPageContent[pageId] ?? {
        heading: "Custom Page",
        body: "",
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
      case "section_intro":
        return <PreviewSectionIntro content={{ ...defaults.section_intro, ...pageContent.section_intro }} />
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
        return null
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {currentPage?.label ?? "Preview"}
            </span>
            <span className="text-xs text-muted-foreground">
              {currentIndex + 1} of {enabledPages.length}
            </span>
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.min(enabledPages.length - 1, i + 1))}
              disabled={currentIndex === enabledPages.length - 1}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-2"
            >
              <X className="size-3.5" />
              Close
            </button>
          </div>
        </div>

        {/* Preview body */}
        <div className="flex-1 overflow-auto p-8 flex items-start justify-center">
          <div
            className={cn(
              "w-full max-w-lg rounded-2xl border p-6 shadow-xl transition-all duration-300",
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
            {currentPage && renderPreview(currentPage.id)}
          </div>
        </div>
      </div>
    </div>
  )
}
