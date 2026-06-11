import { redirect } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { validateAccessToken, getAssessmentItemCount } from "@/app/actions/assess"
import { getCachedEffectiveBrand } from "@/app/actions/brand"
import { getCachedEffectiveExperience } from "@/app/actions/experience"
import { getPostSectionsUrl } from "@/lib/experience/flow-router"
import { getPageContent } from "@/lib/experience/resolve"
import { interpolateContent } from "@/lib/experience/interpolate"
import { generateCSSTokens } from "@/lib/brand/tokens"
import { buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { createAdminClient } from "@/lib/supabase/admin"
import { sanitizeReportHtml } from "@/lib/security/sanitize-html"
import { estimateAssessmentDurationMinutes } from "@/lib/assessments/duration"
import { buttonVariants } from "@/components/ui/button-variants"
import { cn } from "@/lib/utils"
import type { TemplateVariables, ExperienceTemplate } from "@/lib/experience/types"
import type { AssessmentIntroContent, IntroOverride } from "@/types/database"

// Skeleton for the intro body content
interface ValidatedAccessData {
  campaign: { id: string; clientId?: string | null };
  assessments: Array<{ assessmentId: string; title: string }>;
  participant: { firstName?: string };
}



// Async component for intro content — the slow data-fetch part
async function AssessmentIntroContent({
  token,
  idxStr,
  campaign,
  assessments,
  participant,
  experience,
  isCustomBrand,
}: {
  token: string;
  idxStr: string;
  campaign: ValidatedAccessData["campaign"];
  assessments: ValidatedAccessData["assessments"];
  participant: ValidatedAccessData["participant"];
  experience: ExperienceTemplate;
  isCustomBrand: boolean;
}) {
  const idx = parseInt(idxStr, 10)
  const assessment = assessments[idx]
  const db = createAdminClient()

  // Load intro overrides and item count
  const [caRowResult, assessmentRowResult, itemCount] = await Promise.all([
    assessment
      ? db
          .from("campaign_assessments")
          .select("intro_override")
          .eq("campaign_id", campaign.id)
          .eq("assessment_id", assessment.assessmentId)
          .single()
      : Promise.resolve({ data: null }),
    assessment
      ? db
          .from("assessments")
          .select("intro_content")
          .eq("id", assessment.assessmentId)
          .single()
      : Promise.resolve({ data: null }),
    getAssessmentItemCount(assessments.map((a) => a.assessmentId)),
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
    const introContent = assessmentRowResult.data?.intro_content as
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

  const runnerFooterText = getPageContent(experience, "runner").footerText

  // Interpolate template variables
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    candidateName: participant.firstName,
    assessmentTitle: assessment.title,
    estimatedMinutes: estimateAssessmentDurationMinutes(itemCount),
  }
  heading = interpolateContent(heading, variables)
  body = sanitizeReportHtml(interpolateContent(body, variables))
  buttonLabel = interpolateContent(buttonLabel, variables)

  return (
    <>
      {/* Main content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-[540px] space-y-8">
          {/* Heading and body */}
          <div className="space-y-3 text-center">
            <h1
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
              style={{
                color: "var(--brand-text, hsl(var(--foreground)))",
                fontFamily: "var(--brand-font-heading, inherit)",
              }}
            >
              {heading}
            </h1>
            {body && (
              <div
                className="rounded-2xl border border-l-[3px] p-6 sm:p-8 shadow-sm"
                style={{
                  background: "var(--brand-neutral-50, hsl(var(--card)))",
                  borderColor: "var(--brand-neutral-200, hsl(var(--border)))",
                  borderLeftColor: "var(--brand-primary, hsl(var(--primary)))",
                }}
              >
                <div
                  className="prose prose-sm max-w-none leading-relaxed"
                  style={{
                    color:
                      "var(--brand-neutral-500, hsl(var(--muted-foreground)))",
                  }}
                  dangerouslySetInnerHTML={{ __html: body }}
                />
              </div>
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
            ? (runnerFooterText ?? "Powered by Trajectas")
            : "Your responses are confidential"}
        </span>
      </footer>
    </>
  );
}

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

  const { campaign, assessments, participant } = result.data
  const idx = parseInt(idxStr, 10)
  // assessment is used in AssessmentIntroContent via idxStr + assessments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const assessment = assessments[idx]

  // Load brand and experience early for the header + caching
  // These are "use cache"-wrapped, so they're fast
  const [experience, brandConfig] = await Promise.all([
    getCachedEffectiveExperience(campaign.id),
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
  ])

  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name
  const { css: brandCss } = generateCSSTokens(brandConfig)

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

        {/* Deliberately NOT wrapped in Suspense: the same fetch that produces
            the intro content also decides the skip redirects (suppressed /
            disabled / index past end). Streaming a fallback first would turn
            those server redirects into a visible flash + meta refresh. */}
        <AssessmentIntroContent
          token={token}
          idxStr={idxStr}
          campaign={campaign}
          assessments={assessments}
          participant={participant}
          experience={experience}
          isCustomBrand={isCustomBrand}
        />
      </div>
    </>
  )
}
