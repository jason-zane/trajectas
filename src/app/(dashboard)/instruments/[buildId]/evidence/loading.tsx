import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'

export default function EvidenceLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Evidence"
        title="Loading…"
        description="Fetching congruence and fairness data."
      />

      {/* Metrics skeleton */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4">
            <div className="animate-shimmer mb-2 h-4 w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded" />
            <div className="animate-shimmer h-8 w-3/4 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded" />
          </Card>
        ))}
      </div>

      {/* Confusion matrix skeleton */}
      <Card className="p-6">
        <div className="animate-shimmer mb-4 h-5 w-40 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded" />
        <div className="animate-shimmer h-48 w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded" />
      </Card>

      {/* Table skeleton */}
      <Card className="p-6">
        <div className="animate-shimmer mb-4 h-5 w-40 bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-shimmer h-10 w-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded" />
          ))}
        </div>
      </Card>
    </div>
  )
}
