import { getClientBySlug } from "@/app/actions/clients";
import { getAssessmentAssignments } from "@/app/actions/client-entitlements";
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

  return (
    <AssessmentAssignments
      clientId={client.id}
      assignments={assignments}
      allAssessments={allAssessments}
    />
  );
}
