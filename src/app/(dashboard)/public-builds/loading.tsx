import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

export default function PublicBuildsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        title="Public Role Builder"
        description="The funnel, cost meter, and lead list for the public /build tool."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-muted/40 animate-shimmer" />
        ))}
      </div>

      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
