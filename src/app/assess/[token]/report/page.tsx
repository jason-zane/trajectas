import { redirect } from "next/navigation";
import { validateAccessToken, getParticipantReportSnapshot } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent, isPageEnabled } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { ReportScreen } from "@/components/assess/report-screen";
import type { TemplateVariables, ReportContent } from "@/lib/experience/types";

export default async function ReportPage({
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

  if (!isPageEnabled(experience, "report")) {
    redirect(`/assess/${token}/complete`);
  }

  const [brandConfig, snapshot] = await Promise.all([
    getEffectiveBrand(campaign.clientId, campaign.id),
    getParticipantReportSnapshot(token),
  ]);
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  const rawContent = getPageContent(experience, "report");
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    campaignTitle: campaign.title,
  };
  const content: ReportContent = interpolateContent(rawContent, variables);

  // Compute next URL from flow router (e.g. Complete page if it comes after Report)
  const nextUrl = getNextFlowUrl(experience, "report", token);

  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";
  const safeCSS = `${lightCss}\n${darkCss}`;

  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: safeCSS }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <ReportScreen
        content={content}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
        nextUrl={nextUrl}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
        renderedData={snapshot?.renderedData}
      />
    </>
  );
}
