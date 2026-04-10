import { getFactorsForBuilder } from "@/app/actions/assessments";
import { AssessmentBuilder } from "@/app/(dashboard)/assessments/assessment-builder";

export default async function PartnerCreateAssessmentPage() {
  const allFactors = await getFactorsForBuilder();

  return (
    <AssessmentBuilder
      allFactors={allFactors}
      basePath="/partner/assessments"
    />
  );
}
