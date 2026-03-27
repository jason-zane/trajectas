function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`} />
  );
}

export default function CreateCampaignLoading() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="rounded-xl bg-card p-6 space-y-4 ring-1 ring-foreground/[0.06]">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-20 w-full rounded-lg" />
      </div>
      <div className="rounded-xl bg-card p-6 space-y-4 ring-1 ring-foreground/[0.06]">
        <Skeleton className="h-5 w-32" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
