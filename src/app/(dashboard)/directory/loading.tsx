import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function DirectoryLoading() {
  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader
        title="Directory"
        description="Manage partner firms and client accounts from one place."
      >
        <div className="flex items-center gap-2">
          <Shimmer className="h-9 w-20 rounded-lg" />
          <Shimmer className="h-9 w-24 rounded-lg" />
          <Shimmer className="h-10 w-28 rounded-lg" />
        </div>
      </PageHeader>

      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
