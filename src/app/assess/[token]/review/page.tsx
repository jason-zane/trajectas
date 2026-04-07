import { redirect } from "next/navigation";
import {
  validateAccessToken,
  getSessionState,
} from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
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

  const stateResult = await getSessionState(token, currentSession.id);
  if (stateResult.error || !stateResult.data) {
    redirect(`/assess/${token}/welcome`);
  }

  const { sections, responses } = stateResult.data;
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const answeredCount = Object.keys(responses).length;

  // Find the assessment name for the current session
  const currentAssessment = assessments.find(
    (a) => a.assessmentId === currentSession.assessmentId
  );

  // Load brand config for the campaign's client
  const brandConfig = await getEffectiveBrand(campaign.clientId, campaign.id);
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;

  // Load experience template
  const experience = await getEffectiveExperience(campaign.id);
  const rawContent = getPageContent(experience, "review");
  const variables: TemplateVariables = {
    campaignTitle: campaign.title,
    clientName: undefined,
  };
  const content = interpolateContent(rawContent, variables);

  // Server-generated CSS from trusted DB brand config
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

      <ReviewScreen
        token={token}
        sessionId={currentSession.id}
        sections={sections}
        responses={responses}
        totalItems={totalItems}
        answeredCount={answeredCount}
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
