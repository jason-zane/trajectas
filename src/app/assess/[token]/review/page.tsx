import { redirect } from "next/navigation";
import { validateAccessToken, getSessionState } from "@/app/actions/assess";
import { ReviewScreen } from "@/components/assess/review-screen";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await validateAccessToken(token);
  if (result.error) redirect("/assess/expired");

  const { sessions } = result.data!;
  const currentSession = sessions.find((s) => s.status === "in_progress");

  if (!currentSession) {
    redirect(`/assess/${token}/complete`);
  }

  const stateResult = await getSessionState(currentSession.id);
  if (stateResult.error || !stateResult.data) {
    redirect(`/assess/${token}/welcome`);
  }

  const { sections, responses } = stateResult.data;
  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0);
  const answeredCount = Object.keys(responses).length;

  return (
    <ReviewScreen
      token={token}
      sessionId={currentSession.id}
      sections={sections}
      responses={responses}
      totalItems={totalItems}
      answeredCount={answeredCount}
    />
  );
}
