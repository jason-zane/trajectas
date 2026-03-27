import { notFound } from "next/navigation";
import {
  getAssessmentWithCompetencies,
  getCompetenciesForBuilder,
} from "@/app/actions/assessments";
import { AssessmentBuilder } from "../../assessment-builder";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, allFactors] = await Promise.all([
    getAssessmentWithCompetencies(id),
    getCompetenciesForBuilder(),
  ]);

  if (!result) notFound();

  return (
    <AssessmentBuilder
      assessment={result.assessment}
      existingCompetencies={result.competencies}
      allFactors={allFactors}
    />
  );
}
