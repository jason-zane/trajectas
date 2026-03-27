import { getFactorsForBuilder } from "@/app/actions/assessments";
import { AssessmentBuilder } from "../assessment-builder";

export default async function CreateAssessmentPage() {
  const allFactors = await getFactorsForBuilder();

  return <AssessmentBuilder allFactors={allFactors} />;
}
