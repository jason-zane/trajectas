import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";
import { Shimmer } from "@/components/loading/shimmer";

export default function PartnerDiagnosticDetailLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Diagnostic Detail"
        description="View diagnostic campaign details."
      >
        <div className="flex items-center gap-2">
          <Shimmer className="h-10 w-28 rounded-lg" />
          <Shimmer className="h-10 w-32 rounded-lg" />
        </div>
      </PageHeader>

      <DataTableLoading columnCount={5} filterCount={0} />
    </div>
  );
}
