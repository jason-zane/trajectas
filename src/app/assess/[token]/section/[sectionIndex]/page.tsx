import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  validateAccessToken,
  startSession,
  getSessionState,
  startSectionTiming,
} from "@/app/actions/assess";
import { getCachedEffectiveBrand } from "@/app/actions/brand";
import { getCachedEffectiveExperience } from "@/app/actions/experience";
import { getPageContent } from "@/lib/experience/resolve";
import { getPostSectionsUrl } from "@/lib/experience/flow-router";
import { TRAJECTAS_DEFAULTS } from "@/lib/brand/defaults";
import { SectionWrapper } from "@/components/assess/section-wrapper";
import { BrandedMessage } from "@/components/errors/branded-message";
import { Button } from "@/components/ui/button";
import { classifyAssessRuntimeError } from "@/lib/assess/classify-runtime-error";

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
      return renderBrandedAssessError(sessionResult.error, token);
    }

    sessionId = sessionResult.id!;
  }

  if (!sessionId) {
    redirect(`/assess/${token}/welcome`);
  }

  const stateResult = await getSessionState(token, sessionId);

  if (stateResult.error || !stateResult.data) {
    return renderBrandedAssessError(
      stateResult.error ?? "Failed to load session",
      token,
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

  // Start (or resume) this section's server-stamped clock. Deliberately
  // scoped to the section actually being rendered, not done inside
  // getSessionState — starting every section's clock on first load would
  // begin timing sections the participant hasn't reached yet. Best-effort:
  // if this fails, the section still renders, just without a countdown —
  // enforcement lives in the save RPCs regardless of whether the client got
  // a timing payload.
  const timingResult = await startSectionTiming(token, sessionId, section.id);

  // LR-6 / #336 practice-completion gate: this section couldn't start
  // because a 'practice'-role section still has unanswered items. Route the
  // participant back to the first practice section with something
  // unanswered — never render this (scored) section untimed, and never
  // surface a raw/opaque failure for what is really "go finish practice".
  if ("blocked" in timingResult && timingResult.blocked === "practice_incomplete") {
    const practiceSectionIdx = sections.findIndex(
      (s) => s.sectionRole === "practice" && s.items.some((it) => !(it.id in responses)),
    );
    if (practiceSectionIdx !== -1) {
      redirect(`/assess/${token}/section/${practiceSectionIdx}`);
    }
    // Defensive fallback — the gate says practice is incomplete but every
    // practice item in the delivered payload already has a response. Should
    // not happen (the gate and this payload read the same underlying
    // participant_responses rows), but fail loudly with a branded surface
    // rather than rendering a broken/untimed scored section.
    return renderBrandedAssessError(
      "Please finish the practice items before continuing.",
      token,
    );
  }

  const sectionWithTiming =
    "data" in timingResult ? { ...section, timing: timingResult.data } : section;

  // Load brand + experience in parallel — they're independent.
  const [brandConfig, experience] = await Promise.all([
    getCachedEffectiveBrand(campaign.clientId, campaign.id),
    getCachedEffectiveExperience(campaign.id),
  ]);
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
        section={sectionWithTiming}
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

function renderBrandedAssessError(message: string, token: string) {
  const classified = classifyAssessRuntimeError(message);
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <BrandedMessage
        eyebrow={classified.eyebrow}
        title={classified.title}
        description={classified.description}
        actions={
          <Link href={`/assess/${token}/welcome`}>
            <Button variant="outline">
              <ArrowLeft className="size-4" />
              Back to start
            </Button>
          </Link>
        }
      />
    </div>
  );
}
