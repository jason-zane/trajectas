import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-5 w-48 rounded bg-muted/40 animate-shimmer" />
        <div className="h-4 w-64 rounded bg-muted/40 animate-shimmer mt-1" />
      </div>
      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
