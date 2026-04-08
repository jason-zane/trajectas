import { DataTableLoading } from "@/components/data-table";

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function CampaignParticipantsLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="space-y-3">
          <Shimmer className="h-5 w-32" />
          <Shimmer className="h-4 w-64" />
          <Shimmer className="h-10 w-full rounded-lg" />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Shimmer className="h-5 w-36" />
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28 rounded-lg" />
          <Shimmer className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      <DataTableLoading columnCount={3} filterCount={0} />
    </div>
  );
}
