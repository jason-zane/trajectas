import { redirect } from "next/navigation";
import {
  validateAccessToken,
  startSession,
  getSessionState,
} from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { getPageContent } from "@/lib/experience/resolve";
import { getPostSectionsUrl } from "@/lib/experience/flow-router";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { SectionWrapper } from "@/components/assess/section-wrapper";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ token: string; sectionIndex: string }>;
}) {
  const { token, sectionIndex: sectionIdxStr } = await params;
  const sectionIdx = parseInt(sectionIdxStr, 10);

  const result = await validateAccessToken(token);
  if (result.error) redirect("/assess/expired");

  const { campaign, participant, assessments } = result.data!;

  if (assessments.length === 0) {
    redirect(`/assess/${token}/complete`);
  }

  // Work through assessments sequentially
  const sessions = result.data!.sessions;
  let targetAssessment = assessments[0];
  for (const a of assessments) {
    const session = sessions.find(
      (s) => s.assessmentId === a.assessmentId && s.status === "completed"
    );
    if (!session) {
      targetAssessment = a;
      break;
    }
  }

  // Start or resume session
  const sessionResult = await startSession(
    token,
    participant.id,
    targetAssessment.assessmentId,
    campaign.id
  );

  if ("error" in sessionResult && sessionResult.error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-destructive">{sessionResult.error}</p>
      </div>
    );
  }

  const sessionId = sessionResult.id!;
  const stateResult = await getSessionState(token, sessionId);

  if (stateResult.error || !stateResult.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-destructive">
          {stateResult.error ?? "Failed to load session"}
        </p>
      </div>
    );
  }

  const { sections, responses } = stateResult.data;

  if (sections.length === 0) {
    redirect(`/assess/${token}/review`);
  }

  const clampedIdx = Math.min(sectionIdx, sections.length - 1);
  const section = sections[clampedIdx];

  // Load brand + experience in parallel — they're independent.
  const [brandConfig, experience] = await Promise.all([
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
    getCachedEffectiveExperience(campaign.id),
  ]);
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
  const runnerContent = getPageContent(experience, "runner");

  // Find current assessment's position in the campaign's assessment list
  const currentAssessmentIdx = assessments.findIndex(
    (a) => a.assessmentId === targetAssessment.assessmentId
  );
  const nextAssessmentIdx = currentAssessmentIdx + 1;

  let postAssessmentUrl: string;
  if (nextAssessmentIdx < assessments.length) {
    // More assessments to go — route to next assessment's intro
    postAssessmentUrl = `/assess/${token}/assessment-intro/${nextAssessmentIdx}`;
  } else {
    // Last assessment — route to first post-assessment page
    postAssessmentUrl = getPostSectionsUrl(experience, token);
  }

  // Generate org-specific CSS tokens
  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";
  const brandCss = `${lightCss}\n${darkCss}`;

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <SectionWrapper
        token={token}
        sessionId={sessionId}
        section={section}
        sectionIndex={clampedIdx}
        totalSections={sections.length}
        allSections={sections}
        existingResponses={responses}
        assessmentName={targetAssessment.title}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
        runnerContent={runnerContent}
        postAssessmentUrl={postAssessmentUrl}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
        showProgress={campaign.showProgress}
      />
    </>
  );
}
