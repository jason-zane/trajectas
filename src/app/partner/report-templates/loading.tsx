import { PageHeader } from "@/components/page-header";
import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader eyebrow="Reports" title="Report templates" />
      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
