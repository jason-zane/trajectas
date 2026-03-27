import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";

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

  const { candidate, sessions } = result.data!;

  // Check if candidate has completed everything
  if (candidate.status === "completed") {
    redirect(`/assess/${token}/complete`);
  }

  // Check for in-progress session to resume
  const inProgress = sessions.find((s) => s.status === "in_progress");
  if (inProgress && inProgress.currentSectionId) {
    // Find section index
    const sectionIdx = result.data!.assessments.findIndex(
      (a) => a.id === inProgress.assessmentId,
    );
    redirect(`/assess/${token}/section/0`);
  }

  // Default: show welcome
  redirect(`/assess/${token}/welcome`);
}
