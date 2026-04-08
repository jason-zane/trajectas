import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

export default function MatchingLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="AI Matching Engine"
        description="Use AI to match client diagnostic results with factor frameworks."
      />

      <DataTableLoading columnCount={4} filterCount={1} />
    </div>
  );
}
