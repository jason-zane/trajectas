import { redirect } from "next/navigation";
import { validateAccessToken, submitSession } from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/lib/dal/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { getPageContent } from "@/lib/experience/resolve";
import { interpolateContent } from "@/lib/experience/interpolate";
import { getNextFlowUrl } from "@/lib/experience/flow-router";
import { CompleteScreen } from "@/components/assess/complete-screen";
import type { TemplateVariables } from "@/lib/experience/types";

export default async function CompletePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await validateAccessToken(token);
  if (result.error || !result.data) redirect('/assess/expired');
  const { campaign, participant, sessions, assessments } = result.data;
  const brandConfig = await getCachedEffectiveBrand(campaign.clientId, campaign.id);
  const campaignId = campaign.id;
  const participantName = participant.firstName;
  let effectiveToken = token;
  const inProgressSession = sessions.find(session => session.status === 'in_progress');
  if (inProgressSession) {
    const submitted = await submitSession(token, inProgressSession.id);
    if (!submitted.ok) redirect(`/assess/${token}/section/0`);
    if (submitted.refreshedAccessToken) effectiveToken = submitted.refreshedAccessToken;
    // Re-read durable state; the request's original session snapshot is now stale.
    redirect(`/assess/${effectiveToken}/complete`);
  }
  if (assessments.length === 0) redirect(`/assess/${token}/welcome`);
  const hasCompleted = sessions.some(session => session.status === 'completed');
  const requiredComplete = assessments.filter(assessment => assessment.isRequired).every(assessment =>
    sessions.some(session => session.assessmentId === assessment.assessmentId && session.status === 'completed'));
  if (!hasCompleted || !requiredComplete) redirect(`/assess/${token}/section/0`);

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
