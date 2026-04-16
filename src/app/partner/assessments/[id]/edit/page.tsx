import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getAssessmentWithFactors,
  getExistingBlocks,
  getFactorsForBuilder,
  getConstructsForBuilder,
} from "@/app/actions/assessments";
import { AssessmentBuilder } from "@/app/(dashboard)/assessments/assessment-builder";

export default async function PartnerEditAssessmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, allFactors, allConstructs] = await Promise.all([
    getAssessmentWithFactors(id),
    getFactorsForBuilder(),
    getConstructsForBuilder(),
  ]);

  if (!result) notFound();

  const existingBlocks =
    result.assessment.formatMode === "forced_choice"
      ? await getExistingBlocks(id)
      : undefined;

  return (
    <>
      <nav className="mb-6 flex gap-6 border-b border-border">
        <span className="border-b-2 border-primary pb-2 text-sm font-medium text-foreground">
          Builder
        </span>
        <Link
          href={`/partner/assessments/${id}/edit/intro`}
          className="border-b-2 border-transparent pb-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Intro
        </Link>
      </nav>

      <AssessmentBuilder
        assessment={result.assessment}
        existingFactors={result.factors}
        existingConstructs={result.constructs}
        existingSections={result.sections}
        existingBlocks={existingBlocks}
        allFactors={allFactors}
        allConstructs={allConstructs}
        basePath="/partner/assessments"
      />
    </>
  );
}
