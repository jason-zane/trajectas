import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
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

  // Load brand config for the campaign's client
  const brandConfig = await getEffectiveBrand(campaign.clientId, campaign.id);
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  // Load experience template
  const experience = await getEffectiveExperience(campaign.id);
  const rawContent = getPageContent(experience, "welcome");

  // Interpolate template variables
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    campaignTitle: campaign.title,
    campaignDescription: campaign.description,
    assessmentCount: assessments.length,
    clientName: undefined,
  };
  const content = interpolateContent(rawContent, variables);

  // Generate org-specific CSS tokens (server-generated from trusted DB brand config)
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
      {/* Server-generated CSS custom properties from trusted DB brand config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <WelcomeScreen
        token={token}
        campaignTitle={campaign.title}
        campaignDescription={campaign.description}
        assessmentCount={assessments.length}
        participantFirstName={participant.firstName}
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
