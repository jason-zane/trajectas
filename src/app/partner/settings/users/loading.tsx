import { PageHeader } from "@/components/page-header";
import { Shimmer } from "@/components/loading/shimmer";

export default function PartnerUsersLoading() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader eyebrow="Settings" title="Team Members">
        <Shimmer className="h-10 w-28 rounded-lg" />
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Shimmer key={index} className="h-9 w-28 rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Shimmer key={index} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <Shimmer className="h-10 w-full rounded-lg lg:max-w-sm" />
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="grid grid-cols-[1.8fr_1fr_1.4fr_1fr_1fr] gap-3 border-b border-border px-4 py-4 last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <Shimmer className="size-10 rounded-full" />
              <div className="space-y-2">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-40" />
              </div>
            </div>
            <Shimmer className="h-6 w-28 rounded-full" />
            <div className="flex items-center gap-2">
              <Shimmer className="h-6 w-20 rounded-full" />
              <Shimmer className="h-6 w-16 rounded-full" />
            </div>
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
