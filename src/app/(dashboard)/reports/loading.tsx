import { PageHeader } from '@/components/page-header'

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <PageHeader eyebrow="Reports" title="Reports" />
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-0">
            <div className="size-8 rounded-lg bg-muted animate-shimmer shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 rounded bg-muted animate-shimmer" />
              <div className="h-3 w-32 rounded bg-muted animate-shimmer" />
            </div>
            <div className="h-5 w-20 rounded-full bg-muted animate-shimmer" />
          </div>
        ))}
      </div>
    </div>
  )
}
