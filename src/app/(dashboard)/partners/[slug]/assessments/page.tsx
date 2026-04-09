import { notFound, redirect } from "next/navigation";
import { getPartnerBySlug } from "@/app/actions/partners";
import { getPartnerAssessmentAssignments } from "@/app/actions/partner-entitlements";
import { getAssessments } from "@/app/actions/assessments";
import { canManagePartnerDirectory, resolveAuthorizedScope } from "@/lib/auth/authorization";
import { PartnerAssessmentAssignments } from "./partner-assessment-assignments";

export default async function PartnerAssessmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [partner, scope] = await Promise.all([
    getPartnerBySlug(slug),
    resolveAuthorizedScope(),
  ]);
  if (!partner) notFound();
  if (!canManagePartnerDirectory(scope)) {
    redirect("/unauthorized?reason=partner-directory");
  }

  const [assignments, allAssessments] = await Promise.all([
    getPartnerAssessmentAssignments(partner.id),
    getAssessments(),
  ]);

  // Filter to active assessments only
  const activeAssessments = allAssessments.filter((a) => a.status === "active");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-section">Assessment Assignments</h2>
        <p className="text-caption mt-0.5">
          Manage which assessments this partner can deploy to their clients.
        </p>
      </div>
      <PartnerAssessmentAssignments
        assignments={assignments}
        allAssessments={activeAssessments}
        partnerId={partner.id}
      />
    </div>
  );
}
