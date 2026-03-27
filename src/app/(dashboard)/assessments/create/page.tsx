import { getCompetenciesForBuilder } from "@/app/actions/assessments";
import { AssessmentBuilder } from "../assessment-builder";

export default async function CreateAssessmentPage() {
  const allFactors = await getCompetenciesForBuilder();

  return <AssessmentBuilder allFactors={allFactors} />;
}
