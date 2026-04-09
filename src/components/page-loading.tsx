import { cn } from "@/lib/utils";

function LoadingShimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%]",
        className
      )}
    />
  );
}

interface FormPageLoadingProps {
  className?: string;
  fieldCount?: number;
  includeStickyActions?: boolean;
}

export function FormPageLoading({
  className,
  fieldCount = 4,
  includeStickyActions = true,
}: FormPageLoadingProps) {
  return (
    <div className={cn("space-y-8 max-w-2xl", className)}>
      <div className="space-y-4">
        <LoadingShimmer className="h-3.5 w-40" />
        <div className="space-y-2">
          <LoadingShimmer className="h-7 w-52" />
          <LoadingShimmer className="h-4 w-80" />
        </div>
      </div>

      <div className="rounded-xl bg-card p-6 shadow-sm ring-1 ring-foreground/[0.06] space-y-6">
        <div className="space-y-2">
          <LoadingShimmer className="h-5 w-32" />
          <LoadingShimmer className="h-3 w-64" />
        </div>

        {Array.from({ length: fieldCount }).map((_, index) => (
          <div
            key={index}
            className="space-y-2"
            style={{ animationDelay: `${index * 70}ms` }}
          >
            <LoadingShimmer className="h-4 w-24" />
            <LoadingShimmer className="h-10 w-full rounded-lg" />
            <LoadingShimmer className="h-3 w-52" />
          </div>
        ))}
      </div>

      {includeStickyActions ? (
        <div className="flex items-center justify-end gap-3 border-t border-border/50 py-4">
          <LoadingShimmer className="h-9 w-24 rounded-lg" />
          <LoadingShimmer className="h-9 w-36 rounded-lg" />
        </div>
      ) : null}
    </div>
  );
}
