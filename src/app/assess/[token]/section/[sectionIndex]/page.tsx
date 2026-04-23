import { redirect } from "next/navigation";
import {
  validateAccessToken,
  startSession,
  getSessionState,
} from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { getPageContent } from "@/lib/experience/resolve";
import { getPostSectionsUrl } from "@/lib/experience/flow-router";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
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

  const { campaign, participant, assessments } = result.data!;

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

  // If the target assessment already has a completed session, all assessments
  // are done — redirect to the end of the flow rather than reusing the completed
  // session (which would cause all saves to fail and loop the user back here).
  const targetSessionCompleted = sessions.some(
    (s) => s.assessmentId === targetAssessment.assessmentId && s.status === "completed"
  );
  if (targetSessionCompleted) {
    redirect(`/assess/${token}/complete`);
  }

  const existingSession = sessions.find(
    (session) => session.assessmentId === targetAssessment.assessmentId && session.status === "in_progress"
  );

  let sessionId = existingSession?.id;
  if (!sessionId) {
    const sessionResult = await startSession(
      token,
      participant.id,
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

    sessionId = sessionResult.id!;
  }

  if (!sessionId) {
    redirect(`/assess/${token}/welcome`);
  }

  // Session state, brand, and experience are all independent — fetch in parallel.
  const [stateResult, brandConfig, experience] = await Promise.all([
    getSessionState(token, sessionId),
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
    getCachedEffectiveExperience(campaign.id),
  ]);

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
    redirect(`/assess/${token}/complete`);
  }

  const clampedIdx = Math.min(sectionIdx, sections.length - 1);
  const section = sections[clampedIdx];

  if (!section) {
    redirect(`/assess/${token}/complete`);
  }
  const isCustomBrand = brandConfig.name !== TRAJECTAS_DEFAULTS.name;
  const runnerContent = getPageContent(experience, "runner");

  // Find current assessment's position in the campaign's assessment list
  const currentAssessmentIdx = assessments.findIndex(
    (a) => a.assessmentId === targetAssessment.assessmentId
  );
  const nextAssessmentIdx = currentAssessmentIdx + 1;

  let postAssessmentUrl: string;
  if (nextAssessmentIdx < assessments.length) {
    // More assessments to go — route to next assessment's intro
    postAssessmentUrl = `/assess/${token}/assessment-intro/${nextAssessmentIdx}`;
  } else {
    // Last assessment — route to first post-assessment page
    postAssessmentUrl = getPostSectionsUrl(experience, token);
  }

  // Brand CSS + Google Fonts <link> are injected once by the token layout
  // (src/app/assess/[token]/layout.tsx) and inherited by all children.

  return (
    <>
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
        runnerContent={runnerContent}
        postAssessmentUrl={postAssessmentUrl}
        privacyUrl={experience.privacyUrl}
        termsUrl={experience.termsUrl}
        showProgress={campaign.showProgress}
      />
    </>
  );
}
