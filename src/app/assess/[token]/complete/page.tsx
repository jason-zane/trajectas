import { validateAccessToken, submitSession } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { CompleteScreen } from "@/components/assess/complete-screen";
import type { BrandConfig } from "@/lib/brand/types";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let brandConfig: BrandConfig | null = null;
  let campaignId: string | undefined;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      campaignId = result.data.campaign.id;
      brandConfig = await getCachedEffectiveBrand(
        result.data.campaign.clientId,
        result.data.campaign.id,
      );
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
    // Fall through — brandConfig stays null, resolved below.
  }

  // Fallback only when token validation fails / no campaign. This preserves
  // the prior behaviour of showing the platform brand even on an expired link.
  if (!brandConfig) {
    brandConfig = await getCachedEffectiveBrand();
  }
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;

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

  // Brand CSS + Google Fonts <link> are injected once by the token layout
  // (src/app/assess/[token]/layout.tsx) and inherited here.

  return (
    <CompleteScreen
      content={content}
      brandLogoUrl={brandConfig.logoUrl}
      brandName={brandConfig.name}
      isCustomBrand={isCustomBrand}
      nextUrl={nextUrl}
      privacyUrl={experience.privacyUrl}
      termsUrl={experience.termsUrl}
    />
  );
}
