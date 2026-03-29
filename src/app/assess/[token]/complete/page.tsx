import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { CompleteScreen } from "@/components/assess/complete-screen";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Try to load brand config and experience template from the campaign
  let brandConfig = await getEffectiveBrand();
  let isCustomBrand = false;
  let campaignId: string | undefined;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      campaignId = result.data.campaign.id;
      if (result.data.campaign.organizationId) {
        brandConfig = await getEffectiveBrand(
          result.data.campaign.organizationId
        );
        isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;
      }
    }
  } catch {
    // Use default brand if token validation fails
  }

  const experience = await getEffectiveExperience(campaignId);
  const rawContent = getPageContent(experience, "complete");
  const variables: TemplateVariables = {};
  const content = interpolateContent(rawContent, variables);

  // Compute next URL from flow router (e.g. Report page if it comes after Complete)
  const nextUrl = getNextFlowUrl(experience, "complete", token);

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
      {/* eslint-disable-next-line react/no-danger -- server-generated CSS from validated brand config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <CompleteScreen
        content={content}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
        nextUrl={nextUrl}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
      />
    </>
  );
}
