import { Skeleton } from '@/components/ui/skeleton'

export default function InstrumentLoadingPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-96" />
        <Skeleton className="h-4 w-full max-w-2xl" />
      </div>

      {/* Blueprints section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>

        {/* Blueprint cards skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
