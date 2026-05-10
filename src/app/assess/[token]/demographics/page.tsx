import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
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

  // Fire experience + brand in parallel once we have the campaign.
  const [experience, brandConfig] = await Promise.all([
    getCachedEffectiveExperience(campaign.id),
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
  ]);

  const nextUrl = getNextFlowUrl(experience, "demographics", token) ?? `/assess/${token}/section/0`;

  if (!isPageEnabled(experience, "demographics")) {
    redirect(nextUrl);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((participant as any).demographicsCompletedAt) {
    redirect(nextUrl);
  }

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

  // Brand CSS + Google Fonts <link> are injected by the token layout
  // (src/app/assess/[token]/layout.tsx) and inherited here.

  return (
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
  );
}
