import { Skeleton } from "@/components/ui/skeleton";

export default function ClientCampaignExperienceLoading() {
  return (
    <div className="flex-1 min-h-0">
      <div className="flex h-full gap-4">
        {/* Left: flow editor panel */}
        <div className="w-72 shrink-0 space-y-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-5 w-32" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>

        {/* Right: preview */}
        <div className="flex-1 rounded-xl border border-border bg-card p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <div className="pt-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
