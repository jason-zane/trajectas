"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens"
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults"
import { buildPageList } from "@/components/flow-editor/flow-sidebar"
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
} from "@/components/flow-editor/previews"
import type { BrandConfig } from "@/lib/brand/types"
import type {
  PageContentMap,
  FlowConfig,
  ExperiencePageType,
  CustomPageContent,
} from "@/lib/experience/types"

const STORAGE_KEY = "tf-experience-preview"

type PreviewMode = "light" | "dark" | "mobile"

const BUILT_IN_PAGES = new Set([
  "join", "welcome", "consent", "demographics",
  "section_intro", "runner", "review", "complete", "report", "expired",
])

interface PreviewData {
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  customPageContent: Record<string, CustomPageContent>
  brandConfig?: BrandConfig | null
}

export default function PreviewExperiencePage() {
  const [data, setData] = useState<PreviewData | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<PreviewMode>("light")

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      try {
        setData(JSON.parse(raw))
      } catch {
        // invalid data
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [])

  const enabledPages = useMemo(() => {
    if (!data) return []
    const all = buildPageList(data.flowConfig)
    return all.filter((p) => p.enabled)
  }, [data])

  const currentPage = enabledPages[currentIndex]

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        setCurrentIndex((i) => Math.max(0, i - 1))
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        setCurrentIndex((i) => Math.min(enabledPages.length - 1, i + 1))
      }
      if (e.key === "Escape") {
        window.close()
      }
    },
    [enabledPages.length]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

  const brandConfig = data?.brandConfig ?? null
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

  if (!data) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-muted-foreground">No preview data available.</p>
          <p className="text-sm text-muted-foreground/60">Return to the experience editor and try again.</p>
        </div>
      </div>
    )
  }

  const modes: { value: PreviewMode; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "mobile", label: "Mobile" },
  ]

  function renderPreview(pageId: string) {
    const isCustom = !BUILT_IN_PAGES.has(pageId)
    if (isCustom) {
      const content = data!.customPageContent[pageId] ?? {
        heading: "Custom Page",
        body: "",
        buttonLabel: "Continue",
      }
      return <PreviewCustom content={content} />
    }

    const page = pageId as ExperiencePageType
    const defaults = DEFAULT_PAGE_CONTENT as PageContentMap
    const pc = data!.pageContent
    const fc = data!.flowConfig

    switch (page) {
      case "join":
        return <PreviewJoin content={{ ...defaults.join, ...pc.join }} />
      case "welcome":
        return <PreviewWelcome content={{ ...defaults.welcome, ...pc.welcome }} />
      case "consent":
        return <PreviewConsent content={{ ...defaults.consent, ...pc.consent }} />
      case "demographics":
        return <PreviewDemographics content={{ ...defaults.demographics, ...pc.demographics }} />
      case "section_intro":
        return <PreviewSectionIntro content={{ ...defaults.section_intro, ...pc.section_intro }} />
      case "runner":
        return <PreviewRunner content={{ ...defaults.runner, ...pc.runner }} />
      case "review":
        return <PreviewReview content={{ ...defaults.review, ...pc.review }} />
      case "complete":
        return <PreviewComplete content={{ ...defaults.complete, ...pc.complete }} />
      case "report": {
        const reportMode = (fc.report as { reportMode?: string })?.reportMode ?? "holding"
        return (
          <PreviewReport
            content={{
              ...defaults.report,
              ...pc.report,
              reportMode: reportMode as "holding" | "view_results",
            }}
          />
        )
      }
      case "expired":
        return <PreviewExpired content={{ ...defaults.expired, ...pc.expired }} />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Header bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur border-b">
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
            onClick={() => window.close()}
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
            "w-full max-w-lg transition-all duration-300",
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
  )
}
