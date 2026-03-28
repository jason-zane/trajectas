import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveExperience } from "@/app/actions/experience";
import { isPageEnabled } from "@/lib/experience/resolve";

export default async function TokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);

  if (result.error) {
    redirect("/assess/expired");
  }

  const { campaign, candidate, sessions } = result.data!;

  // Check if candidate has completed everything
  if (candidate.status === "completed") {
    redirect(`/assess/${token}/complete`);
  }

  // Load experience template for flow routing
  const experience = await getEffectiveExperience(campaign.id);

  // Check for in-progress session to resume
  const inProgress = sessions.find((s) => s.status === "in_progress");
  if (inProgress) {
    redirect(`/assess/${token}/section/0`);
  }

  // Determine next step in the flow based on template config + candidate progress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const candidateAny = candidate as any;

  // 1. Welcome page (always first for new candidates)
  // After welcome, the welcome page routes to consent/demographics/section/0

  // Check if consent is needed
  if (isPageEnabled(experience, "consent") && !candidateAny.consentGivenAt) {
    // Show welcome first, consent comes after
    redirect(`/assess/${token}/welcome`);
  }

  // Check if demographics is needed
  if (
    isPageEnabled(experience, "demographics") &&
    !candidateAny.demographicsCompletedAt
  ) {
    redirect(`/assess/${token}/welcome`);
  }

  // Default: show welcome
  redirect(`/assess/${token}/welcome`);
}
