import { validateAccessToken, submitSession } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
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
  let brandConfig = await getCachedEffectiveBrand();
  let isCustomBrand = false;
  let campaignId: string | undefined;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      campaignId = result.data.campaign.id;
      brandConfig = await getCachedEffectiveBrand(
        result.data.campaign.clientId,
        result.data.campaign.id,
      );
      isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
    }
    // Auto-submit any in-progress session — handles the case where the review
    // page is disabled and submitSession was never triggered by review-screen.
    const inProgressSession = result.data?.sessions?.find(
      (s) => s.status === "in_progress",
    );
    if (inProgressSession) {
      await submitSession(token, inProgressSession.id).catch(() => {});
    }
  } catch {
    // Use default brand if token validation fails
  }

  const experience = await getCachedEffectiveExperience(campaignId);
  const rawContent = getPageContent(experience, "complete");
  const rawRunnerContent = getPageContent(experience, "runner");
  const variables: TemplateVariables = {};
  const interpolated = interpolateContent(rawContent, variables);
  const content = {
    ...interpolated,
    footerText: interpolated.footerText ?? rawRunnerContent.footerText,
  };

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
