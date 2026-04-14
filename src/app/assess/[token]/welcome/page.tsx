import { redirect } from "next/navigation";
import { validateAccessToken, getAssessmentItemCount } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { WelcomeScreen } from "@/components/assess/welcome-screen";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);

  if (result.error) {
    redirect("/assess/expired");
  }

  const { campaign, participant, assessments, sessions } = result.data!;

  const assessmentIds = assessments.map((a) => a.assessmentId)
  const [brandConfig, experience, totalItems] = await Promise.all([
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
    getCachedEffectiveExperience(campaign.id),
    getAssessmentItemCount(assessmentIds),
  ])
  const estimatedMinutes = Math.max(1, Math.round(totalItems * 15 / 60));
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
  const rawContent = getPageContent(experience, "welcome");
  const rawRunnerContent = getPageContent(experience, "runner");

  // Interpolate template variables
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    campaignTitle: campaign.title,
    campaignDescription: campaign.description,
    assessmentCount: assessments.length,
    clientName: undefined,
  };
  const interpolated = interpolateContent(rawContent, variables);
  const content = {
    ...interpolated,
    footerText: interpolated.footerText ?? rawRunnerContent.footerText,
  };

  // Generate org-specific CSS tokens (server-generated from trusted DB brand config)
  const { css: brandCss } = generateCSSTokens(brandConfig);

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      {/* Server-generated CSS custom properties from trusted DB brand config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <WelcomeScreen
        token={token}
        campaignTitle={campaign.title}
        campaignDescription={campaign.description}
        assessmentCount={assessments.length}
        participantFirstName={participant.firstName}
        estimatedMinutes={estimatedMinutes}
        hasInProgressSession={sessions.some((s) => s.status === "in_progress")}
        allowResume={campaign.allowResume}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
        content={content}
        nextUrl={getNextFlowUrl(experience, "welcome", token) ?? `/assess/${token}/section/0`}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
      />
    </>
  );
}
