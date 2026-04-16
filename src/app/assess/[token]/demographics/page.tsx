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
import { DemographicsForm } from "@/components/assess/demographics-form";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function DemographicsPage({
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

  const nextUrl = getNextFlowUrl(experience, "demographics", token) ?? `/assess/${token}/section/0`;

  // If demographics is not enabled, skip
  if (!isPageEnabled(experience, "demographics")) {
    redirect(nextUrl);
  }

  // If demographics already completed, skip
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((participant as any).demographicsCompletedAt) {
    redirect(nextUrl);
  }

  const brandConfig = await getCachedEffectiveBrand(campaign.clientId, campaign.id);
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;

  const rawContent = getPageContent(experience, "demographics");
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
  const fields = experience.demographicsConfig.fields;

  // CSS is server-generated from trusted DB brand config (hex colors only), not user HTML
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

      <DemographicsForm
        token={token}
        participantId={participant.id}
        fields={fields}
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
