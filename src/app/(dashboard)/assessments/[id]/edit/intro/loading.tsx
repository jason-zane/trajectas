import { PageHeader } from "@/components/page-header"

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-shimmer rounded-md bg-gradient-to-r from-muted via-muted/60 to-muted bg-[length:200%_100%] ${className ?? ""}`}
    />
  )
}

export default function IntroLoading() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Back link skeleton */}
      <Skeleton className="h-4 w-28" />

      <PageHeader eyebrow="Assessment" title="Loading..." />

      {/* Toggle card skeleton */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-6 py-5">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-5 w-9 rounded-full" />
        </div>
      </div>

      {/* Editor card skeleton */}
      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="space-y-6 px-6 py-6">
          {/* Heading input */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>

          {/* Body editor */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-12" />
            {/* Toolbar shimmer */}
            <Skeleton className="h-10 w-full rounded-t-lg" />
            {/* Editor area shimmer */}
            <Skeleton className="h-32 w-full rounded-b-lg" />
          </div>

          {/* Button label input */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  )
}
