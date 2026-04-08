import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function AssessmentsLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Assessments"
        title="Assessments"
        description="Build and manage psychometric assessments from your factor library."
      >
        <Shimmer className="h-10 w-44 rounded-lg" />
      </PageHeader>

      <div className="flex gap-2">
        <Shimmer className="h-9 w-28 rounded-lg" />
        <Shimmer className="h-9 w-40 rounded-lg" />
      </div>

      <DataTableLoading columnCount={4} filterCount={1} />
    </div>
  );
}
