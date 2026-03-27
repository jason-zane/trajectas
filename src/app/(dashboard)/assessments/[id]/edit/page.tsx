import { notFound } from "next/navigation";
import {
  getAssessmentWithFactors,
  getFactorsForBuilder,
  getExistingBlocks,
} from "@/app/actions/assessments";
import { AssessmentBuilder } from "../../assessment-builder";

export default async function EditAssessmentPage({
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

  // Load existing FC blocks for forced-choice assessments
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
    />
  );
}
