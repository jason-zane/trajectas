import { notFound, redirect } from "next/navigation";
import { getSessionDetail } from "@/app/actions/sessions";
import { ResetSessionButton } from "@/components/admin/reset-session-button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SessionDetailView } from "@/components/results/session-detail-view";

export default async function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string; sid: string }>;
}) {
  const { id: participantId, sid: sessionId } = await params;

  const session = await getSessionDetail(sessionId);
  if (!session) {
    notFound();
  }
  if (session.participantId !== participantId) {
    redirect(`/participants/${session.participantId}/sessions/${sessionId}`);
  }
  return (
    <div className="space-y-6">
      <SessionDetailView
        session={session}
        canSeeResponses={true}
        backHref={`/participants/${participantId}`}
        backLabel="Back to participant"
      />
      <Card>
        <CardHeader>
          <CardTitle>Admin actions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResetSessionButton sessionId={sessionId} />
        </CardContent>
      </Card>
    </div>
  );
}
