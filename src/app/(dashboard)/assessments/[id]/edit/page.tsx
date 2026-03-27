import { notFound } from "next/navigation";
import {
  getAssessmentWithFactors,
  getFactorsForBuilder,
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

  return (
    <AssessmentBuilder
      assessment={result.assessment}
      existingFactors={result.factors}
      existingSections={result.sections}
      allFactors={allFactors}
    />
  );
}
