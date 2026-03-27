import { redirect } from "next/navigation";
import { validateAccessToken } from "@/app/actions/assess";
import { WelcomeScreen } from "@/components/assess/welcome-screen";

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);

  if (result.error) {
    redirect("/assess/expired");
  }

  const { campaign, candidate, assessments, sessions } = result.data!;

  return (
    <WelcomeScreen
      token={token}
      campaignTitle={campaign.title}
      campaignDescription={campaign.description}
      assessmentCount={assessments.length}
      candidateFirstName={candidate.firstName}
      hasInProgressSession={sessions.some((s) => s.status === "in_progress")}
      allowResume={campaign.allowResume}
    />
  );
}
