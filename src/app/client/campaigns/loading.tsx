import { DataTableLoading } from "@/components/data-table";
import { PageHeader } from "@/components/page-header";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function ClientCampaignsLoading() {
  return (
    <div className="space-y-8 max-w-5xl">
      <PageHeader
        eyebrow="Campaigns"
        title="Campaigns"
        description="View your assessment campaigns and track completion progress."
      >
        <Shimmer className="h-10 w-40 rounded-lg" />
      </PageHeader>

      <DataTableLoading columnCount={6} filterCount={1} />
    </div>
  );
}
