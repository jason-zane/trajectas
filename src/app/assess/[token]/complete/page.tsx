import { redirect } from "next/navigation";
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
  let participantName: string | undefined;
  // Set when the auto-submit below completes the final required assessment:
  // the server rotates the access token at that moment, so onward links must
  // carry the fresh one.
  let effectiveToken = token;
  let bounceToRunner = false;

  try {
    const result = await validateAccessToken(token);
    if (result.data?.campaign) {
      campaignId = result.data.campaign.id;
      brandConfig = await getCachedEffectiveBrand(
        result.data.campaign.clientId,
        result.data.campaign.id,
      );
    }
    if (result.data?.participant) {
      participantName = result.data.participant.firstName;
    }
    // Auto-submit any in-progress session — handles the case where the review
    // page is disabled and submitSession was never triggered by review-screen.
    // submitSession enforces the completeness gate, so landing here with
    // unanswered questions does NOT complete the session — the participant is
    // bounced back into the runner to finish instead.
    const inProgressSession = result.data?.sessions?.find(
      (s) => s.status === "in_progress",
    );
    if (inProgressSession) {
      const submitResult = await submitSession(token, inProgressSession.id).catch(
        () => null,
      );
      if (!submitResult || !submitResult.ok) {
        bounceToRunner = true;
      } else if (submitResult.refreshedAccessToken) {
        effectiveToken = submitResult.refreshedAccessToken;
      }
    }
  } catch {
    // Fall through — brandConfig stays null, resolved below.
  }

  if (bounceToRunner) {
    // Outside the try/catch: Next's redirect works by throwing.
    redirect(`/assess/${token}`);
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

  const variables: TemplateVariables = {
    participantName,
  };
  const interpolated = interpolateContent(rawContent, variables);
  const content = {
    ...interpolated,
    footerText: interpolated.footerText ?? rawRunnerContent.footerText,
  };

  // Compute next URL from flow router (e.g. Report page if it comes after
  // Complete) — built with the effective token so it survives the post-submit
  // rotation.
  const nextUrl = getNextFlowUrl(experience, "complete", effectiveToken);

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
