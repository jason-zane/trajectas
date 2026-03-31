import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { getEffectiveExperience } from "@/app/actions/experience";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getPageContent, isPageEnabled } from "@/lib/experience/resolve";
import type { ReportContent, TemplateVariables } from "@/lib/experience/types";
import { ReportExportScreen } from "@/components/assess/report-export-screen";

function formatGeneratedAt(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function ReportExportPage({
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

  const brandConfig = await getEffectiveBrand(campaign.organizationId);
  const rawContent = getPageContent(experience, "report");
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    campaignTitle: campaign.title,
  };
  const content: ReportContent = interpolateContent(rawContent, variables);
  const generatedAt = new Date();
  const participantName =
    participant.firstName || participant.lastName
      ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
      : participant.email;

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
      {fontsUrl ? <link rel="stylesheet" href={fontsUrl} /> : null}
      <ReportExportScreen
        content={content}
        participantName={participantName}
        campaignTitle={campaign.title}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name ?? TALENT_FIT_DEFAULTS.name}
        generatedAt={formatGeneratedAt(generatedAt)}
        isReady={content.reportMode === "view_results"}
      />
    </>
  );
}
