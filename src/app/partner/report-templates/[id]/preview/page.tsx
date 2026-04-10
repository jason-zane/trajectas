import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getReportTemplate } from "@/app/actions/reports";
import { ReportRenderer } from "@/components/reports/report-renderer";
import { DEFAULT_REPORT_THEME } from "@/lib/reports/presentation";
import { generateSampleData } from "@/lib/reports/sample-data";

export default async function PartnerReportTemplatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await getReportTemplate(id);

  if (!template) notFound();

  const sampleBlocks = generateSampleData(
    template.blocks as Record<string, unknown>[],
    DEFAULT_REPORT_THEME,
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--report-page-bg, #fafaf8)" }}>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
        Preview — showing sample data.{" "}
        <a
          href={`/partner/report-templates/${id}/builder`}
          className="underline hover:no-underline"
        >
          Back to builder
        </a>
      </div>
      <Suspense>
        <ReportRenderer blocks={sampleBlocks} />
      </Suspense>
    </div>
  );
}
