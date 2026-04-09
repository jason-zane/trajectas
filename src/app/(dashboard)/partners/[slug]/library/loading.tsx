import { DataTableLoading } from "@/components/data-table/data-table-loading";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-5 w-16 rounded bg-muted/40 animate-shimmer" />
        <div className="h-4 w-80 rounded bg-muted/40 animate-shimmer mt-1" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-24 rounded-full bg-muted/40 animate-shimmer" />
        <div className="h-8 w-20 rounded-full bg-muted/40 animate-shimmer" />
        <div className="h-8 w-24 rounded-full bg-muted/40 animate-shimmer" />
      </div>
      <DataTableLoading columnCount={5} filterCount={1} />
    </div>
  );
}
