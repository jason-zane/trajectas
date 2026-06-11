import { Shimmer } from "@/components/loading/shimmer";

// Mirrors the report viewer: title, intro line, report body, footer block —
// same shape as (dashboard)/reports/[snapshotId]/loading.tsx.
export default function ClientReportLoading() {
  return (
    <div className="max-w-3xl mx-auto space-y-8 p-8">
      <Shimmer className="h-8 w-64" />
      <Shimmer className="h-4 w-full" />
      <Shimmer className="h-[400px] w-full rounded-xl" />
      <Shimmer className="h-40 w-full rounded-xl" />
    </div>
  );
}
