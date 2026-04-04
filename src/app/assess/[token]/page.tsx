import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { getEffectiveExperience } from "@/app/actions/experience";
import { getNextFlowUrl } from "@/lib/experience/flow-router";

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

  const { campaign, participant, sessions } = result.data!;

  // Check if participant has completed everything
  if (participant.status === "completed") {
    redirect(`/assess/${token}/complete`);
  }

  // Load experience template for flow routing
  const experience = await getEffectiveExperience(campaign.id);

  // Check for in-progress session to resume (only if campaign allows resume)
  const inProgress = sessions.find((s) => s.status === "in_progress");
  if (inProgress && campaign.allowResume) {
    redirect(`/assess/${token}/section/0`);
  }

  // Use centralized flow router: join is the current step, go to next
  const nextUrl = getNextFlowUrl(experience, "join", token);
  redirect(nextUrl ?? `/assess/${token}/welcome`);
}
