import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function ClientAssessmentsLoading() {
  return (
    <div className="max-w-6xl space-y-8">
      <PageHeader
        eyebrow="Assessments"
        title="Assessment library"
        description="Review the assessments available to launch in your campaigns."
      >
        <Shimmer className="h-10 w-36 rounded-lg" />
      </PageHeader>

      <DataTableLoading columnCount={7} filterCount={1} />
    </div>
  );
}
