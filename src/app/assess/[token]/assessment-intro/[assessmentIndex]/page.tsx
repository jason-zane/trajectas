import { redirect } from "next/navigation"
import { validateAccessToken, getAssessmentItemCount } from "@/app/actions/assess"
import { RunnerCtaLink } from "@/components/assess/runner-cta-link"
import { getCachedEffectiveBrand } from "@/app/actions/brand"
import { getCachedEffectiveExperience } from "@/app/actions/experience"
import { getPostSectionsUrl } from "@/lib/experience/flow-router"
import { interpolateContent } from "@/lib/experience/interpolate"
import { generateCSSTokens } from "@/lib/brand/tokens"
import { buildGoogleFontsUrl } from "@/lib/brand/fonts"
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults"
import { createAdminClient } from "@/lib/supabase/admin"
import { sanitizeReportHtml } from "@/lib/security/sanitize-html"
import { estimateAssessmentDurationMinutes } from "@/lib/assessments/duration"
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
}: {
  token: string;
  idxStr: string;
  campaign: ValidatedAccessData["campaign"] & { confidentialityMode?: string; inviterName?: string; inviterRole?: string };
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
          // Live row only — after a remove-and-readd the pair has a
          // historical row too, and .single() would error on multiple rows.
          .is("deleted_at", null)
          .maybeSingle()
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

  const estimatedMinutes = estimateAssessmentDurationMinutes(itemCount)
  const isAggregateOnly = campaign.confidentialityMode === "aggregate_only"

  return (
    <>
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-5 sm:px-10 lg:px-[120px] border-b"
        style={{
          borderColor: "var(--runner-hairline)",
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            className="size-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: "var(--runner-accent)",
            }}
          >
            <path d="M12 2a8.5 8.5 0 0 0-8.5 8.5c0 4.5 3.5 8 8.5 11.5 5-3.5 8.5-7 8.5-11.5A8.5 8.5 0 0 0 12 2z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>
        <div className="flex-1" />
        <div
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{
            color: "var(--runner-overline)",
            fontFamily: '"Geist Mono", ui-monospace, monospace',
          }}
        >
          Opening Screen
        </div>
      </header>

      {/* Main content */}
      <main
        className="flex flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10 lg:px-[120px]"
        style={{
          background: "var(--runner-page)",
        }}
      >
        <div className="w-full max-w-[620px] space-y-8">
          {/* Heading */}
          <h1
            className="font-semibold leading-tight"
            style={{
              fontFamily: '"Source Serif 4", Georgia, serif',
              fontSize: "clamp(33px, 5vw, 38px)",
              letterSpacing: "-0.01em",
              color: "var(--runner-display)",
            }}
          >
            {heading}
          </h1>

          {/* Body */}
          {body && (
            <div
              className="leading-relaxed"
              style={{
                color: "var(--runner-text-muted)",
                fontSize: "15px",
                lineHeight: "1.6",
              }}
              dangerouslySetInnerHTML={{ __html: body }}
            />
          )}

          {/* Fact row (assessment title + estimated minutes) */}
          <div
            className="flex items-center gap-4 py-3 px-0"
            style={{
              borderTop: "1px solid var(--runner-hairline)",
              borderBottom: "1px solid var(--runner-hairline)",
            }}
          >
            <span
              className="font-semibold uppercase flex-shrink-0"
              style={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                fontSize: "10px",
                letterSpacing: "0.12em",
                color: "var(--runner-text-meta)",
              }}
            >
              {assessment.title}
            </span>
            <span
              className="font-semibold uppercase"
              style={{
                fontFamily: '"Geist Mono", ui-monospace, monospace',
                fontSize: "10px",
                letterSpacing: "0.12em",
                color: "var(--runner-text-meta)",
              }}
            >
              ~{estimatedMinutes} MIN
            </span>
          </div>

          {/* CTA — client component: this page is a Server Component and
              must not pass event handlers across the RSC boundary. */}
          <RunnerCtaLink href={`/assess/${token}/section/0`}>
            {buttonLabel}
          </RunnerCtaLink>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="flex items-center justify-center px-6 py-4 sm:px-10 lg:px-[120px] border-t"
        style={{
          borderColor: "var(--runner-hairline)",
          background: "var(--runner-page-solid)",
        }}
      >
        <span
          className="text-xs"
          style={{
            color: "var(--runner-text-muted)",
          }}
        >
          {isAggregateOnly
            ? "Your responses are kept completely anonymous and only analysed in aggregate"
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

      <div
        className="flex min-h-dvh flex-col"
        style={{
          background: "var(--runner-page)",
        }}
      >
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
