import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { generateCSSTokens } from "@/lib/brand/tokens";
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
  const experience = await getCachedEffectiveExperience(campaign.id);

  if (!isPageEnabled(experience, "report")) {
    redirect(`/assess/${token}/complete`);
  }

  const brandConfig = await getCachedEffectiveBrand(campaign.clientId, campaign.id);
  const rawContent = getPageContent(experience, "report");
  const variables: TemplateVariables = {
    participantName: participant.firstName,
    candidateName: participant.firstName,
    campaignTitle: campaign.title,
  };
  const content: ReportContent = interpolateContent(rawContent, variables);
  const generatedAt = new Date();
  const participantName =
    participant.firstName || participant.lastName
      ? `${participant.firstName ?? ""} ${participant.lastName ?? ""}`.trim()
      : participant.email;

  const { css: safeCSS } = generateCSSTokens(brandConfig);
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
        brandName={brandConfig.name ?? TRAJECTAS_DEFAULTS.name}
        generatedAt={formatGeneratedAt(generatedAt)}
        isReady={content.reportMode === "view_results"}
      />
    </>
  );
}
