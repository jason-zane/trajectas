export default function PartnerOverviewLoading() {
  return (
    <div className="space-y-8">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/40 animate-shimmer" />
        ))}
      </div>
      {/* Key Context + Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="h-48 rounded-xl bg-muted/40 animate-shimmer lg:col-span-3" />
        <div className="h-48 rounded-xl bg-muted/40 animate-shimmer lg:col-span-2" />
      </div>
      {/* Recent Campaigns */}
      <div className="h-48 rounded-xl bg-muted/40 animate-shimmer" />
    </div>
  );
}
