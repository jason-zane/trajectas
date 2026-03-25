import { notFound } from "next/navigation";
import {
  getAssessmentById,
  getOrganizationsForSelect,
} from "@/app/actions/assessments";
import { AssessmentForm } from "../../assessment-form";

export default async function EditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assessment, organizations] = await Promise.all([
    getAssessmentById(id),
    getOrganizationsForSelect(),
  ]);

  if (!assessment) notFound();

  return (
    <AssessmentForm assessment={assessment} organizations={organizations} />
  );
}
