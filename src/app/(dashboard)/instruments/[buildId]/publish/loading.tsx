import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'

export default function PublishLoading() {
  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        eyebrow="Publish"
        title="Publish to Library"
        description="Review what will be written to the live library before confirming."
      />

      {/* Blockers section placeholder */}
      <Card className="p-6 space-y-3">
        <div className="h-5 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
          <div className="h-4 w-5/6 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
        </div>
      </Card>

      {/* Summary section placeholder */}
      <Card className="p-6 space-y-4">
        <div className="h-5 w-40 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
              <div className="h-6 w-12 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
            </div>
          ))}
        </div>
      </Card>

      {/* Format selector placeholder */}
      <Card className="p-6 space-y-4">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
        <div className="h-10 w-full bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
      </Card>

      {/* Publish button placeholder */}
      <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-shimmer" />
    </div>
  )
}
