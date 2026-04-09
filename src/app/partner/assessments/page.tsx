import { PageHeader } from "@/components/page-header";
import { getWorkspaceAssessmentSummaries } from "@/app/actions/assessments";
import { AssessmentsTable } from "./assessments-table";

export default async function PartnerAssessmentsPage() {
  const assessments = await getWorkspaceAssessmentSummaries();
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Assessments"
        title="Assessments"
        description={`${assessments.length} assessment${assessments.length !== 1 ? "s" : ""} deployed across your campaigns.`}
      />
      <AssessmentsTable assessments={assessments} />
    </div>
  );
}
