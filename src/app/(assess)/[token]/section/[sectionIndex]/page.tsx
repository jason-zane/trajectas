import { redirect } from "next/navigation";
import { validateAccessToken, startSession, getSessionState } from "@/app/actions/assess";
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

  // For now, work through assessments sequentially — pick the first one
  // that doesn't have a completed session
  const sessions = result.data!.sessions;
  let targetAssessment = assessments[0];
  for (const a of assessments) {
    const session = sessions.find(
      (s) => s.assessmentId === a.assessmentId && s.status === "completed",
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
    campaign.id,
  );

  if ("error" in sessionResult && sessionResult.error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive">{sessionResult.error}</p>
      </div>
    );
  }

  const sessionId = sessionResult.id!;
  const stateResult = await getSessionState(sessionId);

  if (stateResult.error || !stateResult.data) {
    return (
      <div className="text-center py-12">
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

  return (
    <SectionWrapper
      token={token}
      sessionId={sessionId}
      section={section}
      sectionIndex={clampedIdx}
      totalSections={sections.length}
      existingResponses={responses}
      showProgress={campaign.showProgress}
      allowResume={campaign.allowResume}
    />
  );
}
