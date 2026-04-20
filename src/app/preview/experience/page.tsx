"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { generateCSSTokens } from "@/lib/brand/tokens"
import { buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { DEFAULT_PAGE_CONTENT, DEFAULT_DEMOGRAPHICS_CONFIG } from "@/lib/experience/defaults"
import { buildPageList } from "@/components/flow-editor/flow-sidebar"
import { JoinForm } from "@/components/assess/join-form"
import { WelcomeScreen } from "@/components/assess/welcome-screen"
import { ConsentScreen } from "@/components/assess/consent-screen"
import { DemographicsForm } from "@/components/assess/demographics-form"
import { ReviewScreen } from "@/components/assess/review-screen"
import { CompleteScreen } from "@/components/assess/complete-screen"
import { ReportScreen } from "@/components/assess/report-screen"
import type { BrandConfig } from "@/lib/brand/types"
import type {
  PageContentMap,
  FlowConfig,
  ExperiencePageType,
  CustomPageContent,
  DemographicsConfig,
  JoinContent,
  WelcomeContent,
  ConsentContent,
  DemographicsContent,
  ReviewContent,
  CompleteContent,
  ReportContent,
} from "@/lib/experience/types"

const STORAGE_KEY = "tf-experience-preview"

type PreviewMode = "desktop" | "mobile"

const BUILT_IN_PAGES = new Set([
  "join", "welcome", "consent", "demographics",
  "runner", "review", "complete", "report", "expired",
])

interface PreviewData {
  pageContent: Partial<PageContentMap>
  flowConfig: Partial<FlowConfig>
  customPageContent: Record<string, CustomPageContent>
  demographicsConfig?: DemographicsConfig
  brandConfig?: BrandConfig | null
}

export default function PreviewExperiencePage() {
  const [data, setData] = useState<PreviewData | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mode, setMode] = useState<PreviewMode>("desktop")

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
    return buildPageList(data.flowConfig).filter((p) => p.enabled)
  }, [data])

  const currentPage = enabledPages[currentIndex]
  const brandConfig = data?.brandConfig ?? null

  const brandStyles = useMemo(() => {
    if (!brandConfig) return {}
    const { tokens } = generateCSSTokens(brandConfig)
    return tokens as unknown as React.CSSProperties
  }, [brandConfig])

  const fontsUrl = useMemo(() => {
    if (!brandConfig) return null
    return buildGoogleFontsUrl([
      brandConfig.headingFont,
      brandConfig.bodyFont,
      brandConfig.monoFont,
    ])
  }, [brandConfig])

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1))
  }, [])

  const goNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(enabledPages.length - 1, i + 1))
  }, [enabledPages.length])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault()
        goPrev()
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault()
        goNext()
      }
      if (e.key === "Escape") {
        window.close()
      }
    },
    [goPrev, goNext]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleKeyDown])

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

  const isMobile = mode === "mobile"
  const brandName = brandConfig?.name
  const brandLogoUrl = brandConfig?.logoUrl
  const isCustomBrand = brandConfig ? brandConfig.name !== "Trajectas" : false

  function renderPreview(pageId: string) {
    const pc = data!.pageContent
    const defaults = DEFAULT_PAGE_CONTENT as PageContentMap
    const demoFields =
      data!.demographicsConfig?.fields ?? DEFAULT_DEMOGRAPHICS_CONFIG.fields

    const isCustom = !BUILT_IN_PAGES.has(pageId)
    if (isCustom) {
      const content = data!.customPageContent[pageId] ?? {
        heading: "Custom Page",
        body: "",
        buttonLabel: "Continue",
      }
      return <CustomPagePreview content={content} />
    }

    const page = pageId as ExperiencePageType
    switch (page) {
      case "join":
        return (
          <JoinForm
            linkToken="preview"
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
            content={{ ...defaults.join, ...pc.join } as JoinContent}
          />
        )
      case "welcome":
        return (
          <WelcomeScreen
            token="preview"
            campaignTitle="Campaign preview"
            campaignDescription="This is how the page will look for participants."
            assessmentCount={1}
            participantFirstName="Alex"
            estimatedMinutes={15}
            hasInProgressSession={false}
            allowResume={false}
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
            content={{ ...defaults.welcome, ...pc.welcome } as WelcomeContent}
            nextUrl="#"
          />
        )
      case "consent":
        return (
          <ConsentScreen
            token="preview"
            participantId="preview"
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
            content={{ ...defaults.consent, ...pc.consent } as ConsentContent}
            nextUrl="#"
          />
        )
      case "demographics":
        return (
          <DemographicsForm
            token="preview"
            participantId="preview"
            fields={demoFields}
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
            content={{ ...defaults.demographics, ...pc.demographics } as DemographicsContent}
            nextUrl="#"
          />
        )
      case "runner":
        return (
          <RunnerPreview
            content={{ ...defaults.runner, ...pc.runner }}
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
          />
        )
      case "review":
        return (
          <ReviewScreen
            token="preview"
            sessionId="preview"
            sections={[]}
            responses={{}}
            assessmentName="Assessment preview"
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
            content={{ ...defaults.review, ...pc.review } as ReviewContent}
            nextUrl="#"
          />
        )
      case "complete": {
        const merged = { ...defaults.complete, ...pc.complete } as CompleteContent
        // Strip redirectUrl so the preview tab doesn't auto-redirect away
        // while the user is reviewing the completion page.
        const { redirectUrl: _s, ...previewContent } = merged
        void _s
        return (
          <CompleteScreen
            content={previewContent as CompleteContent}
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
            nextUrl={null}
          />
        )
      }
      case "report": {
        const reportMode = (data!.flowConfig.report as { reportMode?: string })?.reportMode ?? "holding"
        const merged = {
          ...defaults.report,
          ...pc.report,
          reportMode: reportMode as "holding" | "view_results",
        } as ReportContent
        const { redirectUrl: _s, ...previewContent } = merged
        void _s
        return (
          <ReportScreen
            content={previewContent as ReportContent}
            brandLogoUrl={brandLogoUrl}
            brandName={brandName}
            isCustomBrand={isCustomBrand}
          />
        )
      }
      case "expired":
        return (
          <ExpiredPreview
            heading={pc.expired?.heading ?? defaults.expired.heading}
            body={pc.expired?.body ?? defaults.expired.body}
            brandName={brandName}
            brandLogoUrl={brandLogoUrl}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      {/* Top nav bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">
            {currentPage?.label ?? "Preview"}
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {currentIndex + 1} of {enabledPages.length}
          </span>
          <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-0.5">
            {(["desktop", "mobile"] as PreviewMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-200 capitalize",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            aria-label="Previous page"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={currentIndex === enabledPages.length - 1}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-30"
            aria-label="Next page"
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

      {/* Full-page preview — brand tokens scope to this wrapper so the real
          assess screens pick them up via CSS vars like --brand-primary. */}
      <div
        className={cn(
          "flex-1",
          isMobile && "mx-auto w-full max-w-[420px] border-x",
        )}
        style={{
          ...brandStyles,
          fontFamily: "var(--brand-font-body)",
        }}
      >
        {currentPage && renderPreview(currentPage.id)}
      </div>
    </div>
  )
}

// -- Simple inline previews for pages where a real assess screen isn't viable --

function CustomPagePreview({ content }: { content: CustomPageContent }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--brand-neutral-50, hsl(var(--background)))" }}
    >
      <div className="w-full max-w-xl space-y-6 text-center">
        <h1
          className="font-sans text-[clamp(2rem,4vw,2.75rem)] font-extrabold leading-[1.1] tracking-[-0.03em]"
          style={{
            color: "var(--brand-text, hsl(var(--foreground)))",
            fontFamily: "var(--brand-font-heading, inherit)",
          }}
        >
          {content.heading}
        </h1>
        {content.body && (
          <p
            className="whitespace-pre-wrap text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--brand-neutral-500, hsl(var(--muted-foreground)))" }}
          >
            {content.body}
          </p>
        )}
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center rounded-md px-6 text-sm font-medium"
          style={{
            background: "var(--brand-primary, hsl(var(--primary)))",
            color: "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
          }}
        >
          {content.buttonLabel}
        </button>
      </div>
    </div>
  )
}

function RunnerPreview({
  content,
  brandLogoUrl,
  brandName,
  isCustomBrand,
}: {
  content: {
    backButtonLabel?: string
    saveStatusIdle?: string
    footerText?: string
  }
  brandLogoUrl?: string
  brandName?: string
  isCustomBrand?: boolean
}) {
  // Mirrors the real runner (SectionWrapper + ItemCard + LikertResponse):
  // header with brand logo + Back, progress bar, assessment name label,
  // question card with horizontal Likert options, footer with save status.
  const likertOptions = [
    "Strongly disagree",
    "Disagree",
    "Neutral",
    "Agree",
    "Strongly agree",
  ]
  const selectedIdx = 2

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header
        className="sticky top-0 z-10 flex h-14 items-center justify-between px-4 sm:px-6"
        style={{ background: "var(--brand-neutral-50, hsl(var(--background)))" }}
      >
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              className="h-7 w-auto object-contain"
            />
          ) : (
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--brand-text, hsl(var(--foreground)))" }}
            >
              {brandName ?? "Trajectas"}
            </span>
          )}
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-black/5"
          style={{ color: "var(--brand-text-muted, hsl(var(--muted-foreground)))" }}
        >
          ← {content.backButtonLabel ?? "Back"}
        </button>
      </header>

      {/* Progress bar */}
      <div
        className="h-1 w-full"
        style={{ background: "var(--brand-neutral-200, hsl(var(--border)))" }}
      >
        <div
          className="h-full transition-all"
          style={{
            width: "35%",
            background: "var(--brand-primary, hsl(var(--primary)))",
          }}
        />
      </div>

      {/* Main content — centred item card */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[560px] lg:max-w-[720px] xl:max-w-[820px]">
          <p
            className="mb-8 text-xs font-medium uppercase tracking-widest"
            style={{ color: "var(--brand-primary, hsl(var(--primary)))" }}
          >
            Leadership &amp; Influence
          </p>

          <div
            className="rounded-2xl border p-6 sm:p-8 lg:p-10 shadow-[0_0_40px_-8px_color-mix(in_srgb,var(--brand-primary,hsl(var(--primary)))_15%,transparent)]"
            style={{
              background: "var(--brand-neutral-50, hsl(var(--card)))",
              borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
            }}
          >
            <p
              className="mb-6 min-h-[4rem] text-lg leading-relaxed sm:text-xl sm:leading-relaxed"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              I enjoy taking the lead when a group needs direction.
            </p>

            {/* Likert grid — vertical on mobile, 5 columns on desktop */}
            <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
              {likertOptions.map((label, idx) => {
                const isSelected = idx === selectedIdx
                return (
                  <button
                    key={label}
                    type="button"
                    className={cn(
                      "grid min-h-[56px] place-items-center rounded-xl border-2 px-3 py-3 text-sm font-medium transition-all",
                      isSelected ? "scale-[1.02]" : "hover:scale-[1.01]",
                    )}
                    style={{
                      borderColor: isSelected
                        ? "var(--brand-primary, hsl(var(--primary)))"
                        : "var(--brand-neutral-200, hsl(var(--border)))",
                      background: isSelected
                        ? "var(--brand-surface, hsl(var(--primary) / 0.08))"
                        : "transparent",
                      color: isSelected
                        ? "var(--brand-primary, hsl(var(--primary)))"
                        : "var(--brand-text, hsl(var(--foreground)))",
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Footer — status dot + save message */}
      <footer className="flex items-center justify-center gap-2 px-4 py-4">
        <span className="inline-block size-1.5 rounded-full bg-emerald-400/60" />
        <span
          className="text-xs"
          style={{ color: "var(--brand-neutral-500, hsl(var(--muted-foreground)))" }}
        >
          {content.saveStatusIdle ?? "Responses saved automatically"}
        </span>
        {isCustomBrand && (
          <span
            className="ml-4 text-xs"
            style={{ color: "var(--brand-neutral-400, hsl(var(--muted-foreground)))" }}
          >
            {content.footerText ?? "Powered by Trajectas"}
          </span>
        )}
      </footer>
    </div>
  )
}

function ExpiredPreview({
  heading,
  body,
  brandName,
  brandLogoUrl,
}: {
  heading: string
  body: string
  brandName?: string
  brandLogoUrl?: string
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="flex h-14 items-center px-4 sm:px-6"
        style={{ background: "var(--brand-neutral-50, hsl(var(--background)))" }}
      >
        <div className="flex items-center gap-2.5">
          {brandLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogoUrl}
              alt={brandName ?? "Logo"}
              className="h-7 w-auto object-contain"
            />
          ) : (
            <span
              className="text-sm font-semibold tracking-tight"
              style={{ color: "var(--brand-text, hsl(var(--foreground)))" }}
            >
              {brandName ?? "Trajectas"}
            </span>
          )}
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="max-w-md space-y-4 text-center">
          <h1
            className="font-sans text-[clamp(1.75rem,3vw,2.25rem)] font-extrabold tracking-tight"
            style={{
              color: "var(--brand-text, hsl(var(--foreground)))",
              fontFamily: "var(--brand-font-heading, inherit)",
            }}
          >
            {heading}
          </h1>
          <p
            className="text-[1.0625rem] leading-relaxed"
            style={{ color: "var(--brand-neutral-500, hsl(var(--muted-foreground)))" }}
          >
            {body}
          </p>
        </div>
      </main>
    </div>
  )
}
