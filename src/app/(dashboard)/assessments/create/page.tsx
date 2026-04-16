import { getFactorsForBuilder, getConstructsForBuilder } from "@/app/actions/assessments";
import { AssessmentBuilder } from "../assessment-builder";

export default async function CreateAssessmentPage() {
  const [allFactors, allConstructs] = await Promise.all([
    getFactorsForBuilder(),
    getConstructsForBuilder(),
  ]);

  return <AssessmentBuilder allFactors={allFactors} allConstructs={allConstructs} />;
}
