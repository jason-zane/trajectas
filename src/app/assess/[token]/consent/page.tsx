import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent, isPageEnabled, getDefaultConsentBody } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { DEFAULT_PAGE_CONTENT } from "@/lib/experience/defaults";
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

  const [experience, brandConfig] = await Promise.all([
    getCachedEffectiveExperience(campaign.id),
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
  ]);

  const nextUrl = getNextFlowUrl(experience, "consent", token) ?? `/assess/${token}/section/0`;

  if (!isPageEnabled(experience, "consent")) {
    redirect(nextUrl);
  }

  if (participant.consentGivenAt) {
    redirect(nextUrl);
  }

  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;

  const rawContent = getPageContent(experience, "consent");
  const rawRunnerContent = getPageContent(experience, "runner");

  const variables: TemplateVariables = {
    participantName: participant.firstName,
    candidateName: participant.firstName,
    campaignTitle: campaign.title,
    brandName: brandConfig.name,
  };

  // Use mode-aware default consent body if no override was explicitly set.
  // If the resolved content matches the hardcoded default, it means no campaign
  // or platform override was provided, so we use the mode-appropriate version.
  let bodyText = rawContent.body;
  if (bodyText === DEFAULT_PAGE_CONTENT.consent.body) {
    // No custom override — use mode-aware default
    bodyText = getDefaultConsentBody(campaign.confidentialityMode);
  }

  const interpolated = interpolateContent(
    { ...rawContent, body: bodyText },
    variables
  );
  const content = {
    ...interpolated,
    footerText: interpolated.footerText ?? rawRunnerContent.footerText,
  };

  // Brand CSS + Google Fonts <link> are injected by the token layout
  // (src/app/assess/[token]/layout.tsx) and inherited here.

  return (
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
      inviterName={campaign.inviterName}
      inviterRole={campaign.inviterRole}
      confidentialityMode={campaign.confidentialityMode}
    />
  );
}
