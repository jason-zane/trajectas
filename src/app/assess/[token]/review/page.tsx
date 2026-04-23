import { redirect } from "next/navigation";
import {
  validateAccessToken,
  getSessionState,
} from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { ReviewScreen } from "@/components/assess/review-screen";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);
  if (result.error) redirect("/assess/expired");

  const { campaign, sessions, assessments } = result.data!;
  const currentSession = sessions.find((s) => s.status === "in_progress");

  if (!currentSession) {
    redirect(`/assess/${token}/complete`);
  }

  // Session state, brand, and experience are all independent — fetch in parallel.
  const [stateResult, brandConfig, experience] = await Promise.all([
    getSessionState(token, currentSession.id),
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
    getCachedEffectiveExperience(campaign.id),
  ]);
  if (stateResult.error || !stateResult.data) {
    redirect(`/assess/${token}/welcome`);
  }

  const { sections, responses } = stateResult.data;

  // Find the assessment name for the current session
  const currentAssessment = assessments.find(
    (a) => a.assessmentId === currentSession.assessmentId
  );
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
  const rawContent = getPageContent(experience, "review");
  const rawRunnerContent = getPageContent(experience, "runner");
  const variables: TemplateVariables = {
    campaignTitle: campaign.title,
    clientName: undefined,
  };
  const interpolated = interpolateContent(rawContent, variables);
  const content = {
    ...interpolated,
    footerText: interpolated.footerText ?? rawRunnerContent.footerText,
  };

  // Server-generated CSS from trusted DB brand config
  const { css: brandCss } = generateCSSTokens(brandConfig);

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <ReviewScreen
        token={token}
        sessionId={currentSession.id}
        sections={sections}
        responses={responses}
        assessmentName={currentAssessment?.title}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
        content={content}
        nextUrl={getNextFlowUrl(experience, "review", token) ?? `/assess/${token}/complete`}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
      />
    </>
  );
}
