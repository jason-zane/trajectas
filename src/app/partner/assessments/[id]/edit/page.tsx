import { notFound } from "next/navigation";
import {
  getAssessmentWithFactors,
  getExistingBlocks,
  getFactorsForBuilder,
} from "@/app/actions/assessments";
import { AssessmentBuilder } from "@/app/(dashboard)/assessments/assessment-builder";

export default async function PartnerEditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, allFactors] = await Promise.all([
    getAssessmentWithFactors(id),
    getFactorsForBuilder(),
  ]);

  if (!result) notFound();

  const existingBlocks =
    result.assessment.formatMode === "forced_choice"
      ? await getExistingBlocks(id)
      : undefined;

  return (
    <AssessmentBuilder
      assessment={result.assessment}
      existingFactors={result.factors}
      existingSections={result.sections}
      existingBlocks={existingBlocks}
      allFactors={allFactors}
      basePath="/partner/assessments"
    />
  );
}
