import { getOrganizationBySlug } from "@/app/actions/organizations";
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
  const organization = await getOrganizationBySlug(slug);
  if (!organization) notFound();

  const [assignments, allAssessments] = await Promise.all([
    getAssessmentAssignments(organization.id),
    getAssessments(),
  ]);

  return (
    <AssessmentAssignments
      organizationId={organization.id}
      assignments={assignments}
      allAssessments={allAssessments}
    />
  );
}
