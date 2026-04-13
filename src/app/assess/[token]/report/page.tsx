import { redirect } from "next/navigation";
import { validateAccessToken, getParticipantReportSnapshot } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent, isPageEnabled } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { ReportScreen } from "@/components/assess/report-screen";
import type { TemplateVariables, ReportContent } from "@/lib/experience/types";
import { isSessionProcessingActive } from "@/lib/assess/session-processing";

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
  const latestCompletedSession = [...result.data!.sessions]
    .filter((session) => session.status === "completed")
    .sort((left, right) => {
      const leftTime = Date.parse(left.completedAt ?? left.startedAt ?? "0");
      const rightTime = Date.parse(right.completedAt ?? right.startedAt ?? "0");
      return rightTime - leftTime;
    })[0];
  const experience = await getCachedEffectiveExperience(campaign.id);

  if (!isPageEnabled(experience, "report")) {
    redirect(`/assess/${token}/complete`);
  }

  const [brandConfig, snapshot] = await Promise.all([
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
    getParticipantReportSnapshot(token),
  ]);
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
  const sessionProcessingActive = isSessionProcessingActive(
    latestCompletedSession?.processingStatus,
  );
  const effectiveReportStatus =
    snapshot?.status ??
    (latestCompletedSession?.processingStatus === "failed" ? "failed" : undefined);
  const effectiveReportError =
    snapshot?.errorMessage ?? latestCompletedSession?.processingError;
  const shouldAutoRefresh =
    snapshot?.status === "pending" ||
    snapshot?.status === "generating" ||
    (!snapshot && sessionProcessingActive);

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
        reportStatus={effectiveReportStatus}
        reportError={effectiveReportError}
        autoRefresh={shouldAutoRefresh}
      />
    </>
  );
}
