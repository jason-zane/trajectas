import { redirect } from "next/navigation";
import {
  validateAccessToken,
  startSession,
  getSessionState,
} from "@/app/actions/assess";
import { getEffectiveBrand } from "@/app/actions/brand";
import { generateCSSTokens, generateDarkCSSTokens } from "@/lib/brand/tokens";
import { buildGoogleFontsUrl } from "@/lib/brand/fonts";
import { TALENT_FIT_DEFAULTS } from "@/lib/brand/defaults";
import { SectionWrapper } from "@/components/assess/section-wrapper";

export default async function SectionPage({
  params,
}: {
  params: Promise<{ token: string; sectionIndex: string }>;
}) {
  const { token, sectionIndex: sectionIdxStr } = await params;
  const sectionIdx = parseInt(sectionIdxStr, 10);

  const result = await validateAccessToken(token);
  if (result.error) redirect("/assess/expired");

  const { campaign, candidate, assessments } = result.data!;

  if (assessments.length === 0) {
    redirect(`/assess/${token}/complete`);
  }

  // Work through assessments sequentially
  const sessions = result.data!.sessions;
  let targetAssessment = assessments[0];
  for (const a of assessments) {
    const session = sessions.find(
      (s) => s.assessmentId === a.assessmentId && s.status === "completed"
    );
    if (!session) {
      targetAssessment = a;
      break;
    }
  }

  // Start or resume session
  const sessionResult = await startSession(
    candidate.id,
    targetAssessment.assessmentId,
    campaign.id
  );

  if ("error" in sessionResult && sessionResult.error) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-destructive">{sessionResult.error}</p>
      </div>
    );
  }

  const sessionId = sessionResult.id!;
  const stateResult = await getSessionState(sessionId);

  if (stateResult.error || !stateResult.data) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <p className="text-destructive">
          {stateResult.error ?? "Failed to load session"}
        </p>
      </div>
    );
  }

  const { sections, responses } = stateResult.data;

  if (sections.length === 0) {
    redirect(`/assess/${token}/review`);
  }

  const clampedIdx = Math.min(sectionIdx, sections.length - 1);
  const section = sections[clampedIdx];

  // Load brand config for the campaign's organization
  const brandConfig = await getEffectiveBrand(campaign.organizationId);
  const isCustomBrand = brandConfig.name !== TALENT_FIT_DEFAULTS.name;

  // Generate org-specific CSS tokens (overrides layout defaults if org branded)
  const { css: lightCss } = generateCSSTokens(brandConfig);
  const darkCss = brandConfig.darkModeEnabled
    ? generateDarkCSSTokens(brandConfig)
    : "";

  // CSS is server-generated from trusted DB brand config, not user HTML
  const brandCss = `${lightCss}\n${darkCss}`;

  // Load custom fonts if org has different fonts
  const fontsUrl = buildGoogleFontsUrl([
    brandConfig.headingFont,
    brandConfig.bodyFont,
    brandConfig.monoFont,
  ]);

  return (
    <>
      {/* Org-specific brand token overrides — server-generated CSS from DB config */}
      <style dangerouslySetInnerHTML={{ __html: brandCss }} />
      {fontsUrl && <link rel="stylesheet" href={fontsUrl} />}

      <SectionWrapper
        token={token}
        sessionId={sessionId}
        section={section}
        sectionIndex={clampedIdx}
        totalSections={sections.length}
        allSections={sections}
        existingResponses={responses}
        assessmentName={targetAssessment.title}
        brandLogoUrl={brandConfig.logoUrl}
        brandName={brandConfig.name}
        isCustomBrand={isCustomBrand}
      />
    </>
  );
}
