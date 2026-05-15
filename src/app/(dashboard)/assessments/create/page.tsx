import { getFactorsForBuilder, getConstructsForBuilder } from "@/app/actions/assessments";
import { getContentSources } from "@/app/actions/content-sources";
import { AssessmentBuilder } from "../assessment-builder";

export default async function CreateAssessmentPage() {
  const [allFactors, allConstructs, contentSources] = await Promise.all([
    getFactorsForBuilder(),
    getConstructsForBuilder(),
    getContentSources(),
  ]);

  return (
    <AssessmentBuilder
      allFactors={allFactors}
      allConstructs={allConstructs}
      contentSources={contentSources}
    />
  );
}
