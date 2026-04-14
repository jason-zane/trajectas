import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent, isPageEnabled } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { ConsentScreen } from "@/components/assess/consent-screen";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);

  if (result.error) {
    redirect("/assess/expired");
  }

  const { campaign, participant } = result.data!;
  const experience = await getCachedEffectiveExperience(campaign.id);

  const nextUrl = getNextFlowUrl(experience, "consent", token) ?? `/assess/${token}/section/0`;

  // If consent is not enabled, skip to next page
  if (!isPageEnabled(experience, "consent")) {
    redirect(nextUrl);
  }

  // If participant already consented, skip
  if (participant.consentGivenAt) {
    redirect(nextUrl);
  }

  const brandConfig = await getCachedEffectiveBrand(campaign.clientId, campaign.id);
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;

  const rawContent = getPageContent(experience, "consent");
  const rawRunnerContent = getPageContent(experience, "runner");
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    candidateName: participant.firstName,
    campaignTitle: campaign.title,
  };
  const interpolated = interpolateContent(rawContent, variables);
  const content = {
    ...interpolated,
    footerText: interpolated.footerText ?? rawRunnerContent.footerText,
  };

  const { css: brandCssText } = generateCSSTokens(brandConfig);

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: brandCssText }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <ConsentScreen
        token={token}
        participantId={participant.id}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
        content={content}
        nextUrl={nextUrl}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
      />
    </>
  );
}
