import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { validateAccessToken } from "@/app/actions/assess"
import { getEffectiveBrand } from "@/app/actions/brand"
import { getEffectiveExperience } from "@/app/actions/experience"
import { getPostSectionsUrl } from "@/lib/experience/flow-router"
import { interpolateContent } from "@/lib/experience/interpolate"
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens"
import { buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { createAdminClient } from "@/lib/supabase/admin"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TemplateVariables } from "@/lib/experience/types"
import type { AssessmentIntroContent, IntroOverride } from "@/types/database"

export default async function AssessmentIntroPage({
  params,
}: {
  params: Promise<{ token: string; assessmentIndex: string }>
}) {
  const { token, assessmentIndex: idxStr } = await params
  const result = await validateAccessToken(token)

  if (result.error || !result.data) {
    redirect("/assess/expired")
  }

  const { campaign, assessments } = result.data
  const idx = parseInt(idxStr, 10)
  const assessment = assessments[idx]

  const db = createAdminClient()

  // Load experience + brand + campaign-level intro override in parallel.
  // Experience is needed for the post-sections URL and all three are independent.
  const [experience, brandConfig, caRowResult] = await Promise.all([
    getEffectiveExperience(campaign.id),
    getEffectiveBrand(campaign.clientId, campaign.id),
    assessment
      ? db
          .from("campaign_assessments")
          .select("intro_override")
          .eq("campaign_id", campaign.id)
          .eq("assessment_id", assessment.assessmentId)
          .single()
      : Promise.resolve({ data: null }),
  ])

  // No assessment at this index -- move to post-sections flow
  if (!assessment) {
    redirect(getPostSectionsUrl(experience, token))
  }

  const caRow = caRowResult.data

  const introOverride = caRow?.intro_override as IntroOverride | undefined

  let heading: string
  let body: string
  let buttonLabel: string

  if (introOverride && "suppress" in introOverride && introOverride.suppress) {
    // Campaign suppresses this intro -- skip straight to sections
    redirect(`/assess/${token}/section/0`)
  } else if (
    introOverride &&
    "heading" in introOverride &&
    introOverride.heading
  ) {
    // Campaign provides override content
    heading = introOverride.heading
    body = introOverride.body
    buttonLabel = introOverride.buttonLabel
  } else {
    // Fall back to the assessment's own intro_content
    const { data: assessmentRow } = await db
      .from("assessments")
      .select("intro_content")
      .eq("id", assessment.assessmentId)
      .single()

    const introContent = assessmentRow?.intro_content as
      | AssessmentIntroContent
      | null
      | undefined

    if (!introContent || !introContent.enabled) {
      // No intro configured or disabled -- skip to sections
      redirect(`/assess/${token}/section/0`)
    }

    heading = introContent.heading
    body = introContent.body
    buttonLabel = introContent.buttonLabel
  }

  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name

  // Interpolate template variables
  const variables: TemplateVariables = {
    assessmentTitle: assessment.title,
    questionCount: assessment.sectionCount,
  }
  heading = interpolateContent(heading, variables)
  body = interpolateContent(body, variables)
  buttonLabel = interpolateContent(buttonLabel, variables)

  // Generate brand CSS tokens
  const { css: lightCss } = generateCSSTokens(brandConfig)
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : ""
  const brandCss = `${lightCss}\n${darkCss}`

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ])

  // Body content is admin-authored rich text from the trusted DB (same pattern
  // as the welcome page) -- rendered via dangerouslySetInnerHTML.
  return (
    <>
      {/* Server-generated CSS custom properties from trusted DB brand config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <div className="flex min-h-dvh flex-col">
        {/* Header */}
        <header
          className="flex h-14 items-center px-4 sm:px-6"
          style={{
            background: "var(--brand-neutral-50, hsl(var(--background)))",
          }}
        >
          <div className="flex items-center gap-2.5">
            {brandConfig.logoUrl ? (
              <Image
                src={brandConfig.logoUrl}
                alt={brandConfig.name ?? "Logo"}
                width={140}
                height={28}
                className="h-7 w-auto object-contain"
                unoptimized
              />
            ) : (
              <div className="flex items-center gap-2">
                <div
                  className="flex size-7 items-center justify-center rounded-lg"
                  style={{
                    background:
                      "var(--brand-surface, hsl(var(--primary) / 0.1))",
                  }}
                >
                  <svg
                    className="size-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      color: "var(--brand-primary, hsl(var(--primary)))",
                    }}
                  >
                    <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <span
                  className="text-sm font-semibold tracking-tight"
                  style={{
                    color: "var(--brand-text, hsl(var(--foreground)))",
                  }}
                >
                  {brandConfig.name ?? "Trajectas"}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
          <div className="w-full max-w-[540px] space-y-6">
            {/* Heading and body */}
            <div className="space-y-3 text-center">
              <h1
                className="text-2xl font-semibold tracking-tight sm:text-3xl"
                style={{
                  color: "var(--brand-text, hsl(var(--foreground)))",
                  fontFamily: "var(--brand-font-heading, inherit)",
                }}
              >
                {heading}
              </h1>
              {body && (
                <div
                  className="prose prose-sm max-w-none leading-relaxed dark:prose-invert"
                  style={{
                    color:
                      "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                  }}
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              )}
            </div>

            {/* CTA */}
            <div className="flex justify-center">
              <Link
                href={`/assess/${token}/section/0`}
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "min-w-[200px] gap-1.5",
                )}
                style={{
                  background: "var(--brand-primary, hsl(var(--primary)))",
                  color:
                    "var(--brand-primary-foreground, hsl(var(--primary-foreground)))",
                }}
              >
                <ArrowRight className="size-4" />
                {buttonLabel}
              </Link>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-center gap-3 px-4 py-4">
          <span
            className="text-xs"
            style={{
              color:
                "var(--brand-neutral-400, hsl(var(--muted-foreground)))",
            }}
          >
            {isCustomBrand
              ? "Powered by Trajectas"
              : "Your responses are confidential"}
          </span>
        </footer>
      </div>
    </>
  )
}
