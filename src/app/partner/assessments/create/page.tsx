import {
  getFactorsForBuilder,
  getConstructsForBuilder,
} from "@/app/actions/assessments";
import { AssessmentBuilder } from "@/app/(dashboard)/assessments/assessment-builder";

export default async function PartnerCreateAssessmentPage() {
  const [allFactors, allConstructs] = await Promise.all([
    getFactorsForBuilder(),
    getConstructsForBuilder(),
  ]);

  return (
    <AssessmentBuilder
      allFactors={allFactors}
      allConstructs={allConstructs}
      basePath="/partner/assessments"
    />
  );
}
