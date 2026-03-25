import { getOrganizationsForSelect } from "@/app/actions/assessments";
import { AssessmentForm } from "../assessment-form";

export default async function CreateAssessmentPage() {
  const organizations = await getOrganizationsForSelect();

  return <AssessmentForm organizations={organizations} />;
}
