import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
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
  const experience = await getEffectiveExperience(campaign.id);

  const nextUrl = getNextFlowUrl(experience, "consent", token) ?? `/assess/${token}/section/0`;

  // If consent is not enabled, skip to next page
  if (!isPageEnabled(experience, "consent")) {
    redirect(nextUrl);
  }

  // If participant already consented, skip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((participant as any).consentGivenAt) {
    redirect(nextUrl);
  }

  const brandConfig = await getEffectiveBrand(campaign.organizationId);
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  const rawContent = getPageContent(experience, "consent");
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    campaignTitle: campaign.title,
  };
  const content = interpolateContent(rawContent, variables);

  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";
  // CSS is server-generated from trusted DB brand config (hex colors only), not user HTML
  const brandCssText = `${lightCss}\n${darkCss}`;

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
