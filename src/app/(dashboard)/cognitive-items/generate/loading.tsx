import { Shimmer } from '../skeletons'

/** Mirrors the generate page: header, the guidance banner, then the four-field form card. */
export default function GenerateBankLoading() {
  return (
    <div className="max-w-4xl space-y-8">
      <div className="space-y-3">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-8 w-56" />
        <Shimmer className="h-4 w-full max-w-xl" />
      </div>
      <Shimmer className="h-24 w-full rounded-xl" />
      <div className="space-y-5 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-9 w-full" />
              <Shimmer className="h-3 w-4/5" />
            </div>
          ))}
        </div>
        <Shimmer className="h-9 w-48" />
      </div>
    </div>
  )
}
