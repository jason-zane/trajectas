function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  );
}

export default function OrgSettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
        <Skeleton className="h-5 w-28" />

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3.5 w-72" />
          </div>
          <Skeleton className="h-[18px] w-8 rounded-full" />
        </div>
      </div>

      <Skeleton className="h-3.5 w-96" />
    </div>
  );
}
