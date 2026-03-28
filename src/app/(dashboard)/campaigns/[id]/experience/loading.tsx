export default function CampaignExperienceLoading() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Top bar shimmer */}
      <div className="flex justify-end gap-2 pb-4">
        <div className="h-8 w-28 rounded-md animate-shimmer bg-muted" />
        <div className="h-8 w-24 rounded-md animate-shimmer bg-muted" />
      </div>

      {/* Three-panel layout shimmer */}
      <div className="flex gap-4 flex-1 min-h-0">
        <div className="w-[260px] shrink-0 rounded-lg border border-border p-3 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 w-full rounded-lg animate-shimmer bg-muted"
            />
          ))}
        </div>
        <div className="flex-1 rounded-lg border border-border p-5 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-24 rounded animate-shimmer bg-muted" />
              <div className="h-10 w-full rounded animate-shimmer bg-muted" />
            </div>
          ))}
        </div>
        <div className="w-[380px] shrink-0 space-y-3">
          <div className="h-8 w-40 rounded-lg animate-shimmer bg-muted" />
          <div className="h-[400px] rounded-2xl animate-shimmer bg-muted" />
        </div>
      </div>
    </div>
  );
}
