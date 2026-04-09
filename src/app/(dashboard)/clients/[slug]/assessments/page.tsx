import { getClientBySlug } from "@/app/actions/clients";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
import { getPartnerAssessmentAssignments } from "@/app/actions/partner-entitlements";
import { getAssessments } from "@/app/actions/assessments";
import { notFound } from "next/navigation";
import { AssessmentAssignments } from "./assessment-assignments";

export default async function OrgAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getClientBySlug(slug);
  if (!client) notFound();

  const [assignments, allAssessments] = await Promise.all([
    getAssessmentAssignments(client.id),
    getAssessments(),
  ]);

  // If client belongs to a partner, fetch the partner's assessment pool
  // so the picker only shows assessments from the partner's allocation
  let partnerPoolAssessmentIds: string[] | undefined;
  if (client.partnerId) {
    const partnerAssignments = await getPartnerAssessmentAssignments(
      client.partnerId
    );
    partnerPoolAssessmentIds = partnerAssignments.map((a) => a.assessmentId);
  }

  return (
    <AssessmentAssignments
      clientId={client.id}
      assignments={assignments}
      allAssessments={allAssessments}
      partnerPoolAssessmentIds={partnerPoolAssessmentIds}
    />
  );
}
