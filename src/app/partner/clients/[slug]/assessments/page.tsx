import { getPartnerAssessmentAssignments } from "@/app/actions/partner-entitlements";
import {
  getAssessmentAssignments,
  getAssignableAssessmentsForClient,
} from "@/app/actions/client-entitlements";
import { AssessmentAssignments } from "@/app/(dashboard)/clients/[slug]/assessments/assessment-assignments";
import { requirePartnerClient } from "@/lib/auth/resolve-partner-client";

export default async function PartnerClientAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { client, partnerId } = await requirePartnerClient(slug);

  // `getAssignableAssessmentsForClient` is the same rule the server action and
  // the database trigger apply (D4): the partner's allocation, plus what the
  // partner owns, plus what the client owns.
  const [assignments, assignable, pool] = await Promise.all([
    getAssessmentAssignments(client.id),
    getAssignableAssessmentsForClient(client.id),
    getPartnerAssessmentAssignments(partnerId),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Assessments</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Assessments you can assign come from your allocation and the assessments
          you own. A quota counts the participants invited to this client&apos;s
          campaigns, and cannot exceed your own allocation for that assessment.
        </p>
      </div>
      <AssessmentAssignments
        clientId={client.id}
        assignments={assignments}
        allAssessments={assignable}
        partnerPool={pool.map((entry) => ({
          assessmentId: entry.assessmentId,
          quotaLimit: entry.quotaLimit,
          quotaUsed: entry.quotaUsed,
        }))}
      />
    </div>
  );
}
