import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getAssessmentById } from "@/app/actions/assessments";
import { getAssessmentIntro } from "@/app/actions/assessment-intro";
import { AssessmentIntroEditor } from "@/app/(dashboard)/assessments/[id]/edit/intro/assessment-intro-editor";

export default async function PartnerAssessmentIntroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assessment, introContent] = await Promise.all([
    getAssessmentById(id),
    getAssessmentIntro(id),
  ]);

  if (!assessment) notFound();

  return (
    <div className="space-y-8 max-w-3xl">
      <Link
        href={`/partner/assessments/${id}/edit`}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        Back to Builder
      </Link>

      <PageHeader
        eyebrow="Assessment"
        title={`${assessment.title} — Intro Page`}
      />

      <AssessmentIntroEditor
        assessmentId={id}
        assessmentTitle={assessment.title}
        initialContent={introContent}
      />
    </div>
  );
}
