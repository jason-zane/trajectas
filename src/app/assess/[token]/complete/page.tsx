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

  let brandConfig: BrandConfig;
  let experience;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      const { clientId, id } = result.data.campaign;

      // Auto-submit any in-progress session — handles the case where the
      // review page is disabled and submitSession was never triggered.
      const inProgressSession = result.data.sessions?.find(
        (s) => s.status === "in_progress",
      );

      // Brand, experience, and session submit are independent — run together.
      const [brand, exp] = await Promise.all([
        getCachedEffectiveBrand(clientId, id),
        getCachedEffectiveExperience(id),
        inProgressSession
          ? submitSession(token, inProgressSession.id).catch(() => {})
          : undefined,
      ]);
      brandConfig = brand;
      experience = exp;
    } else {
      [brandConfig, experience] = await Promise.all([
        getCachedEffectiveBrand(),
        getCachedEffectiveExperience(),
      ]);
    }
  } catch {
    // Token invalid / expired — fall back to platform defaults.
    [brandConfig, experience] = await Promise.all([
      getCachedEffectiveBrand(),
      getCachedEffectiveExperience(),
    ]);
  }

  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
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
