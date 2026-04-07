export default function EmailTemplateEditorLoading() {
  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header */}
      <div className="space-y-2">
        <div className="h-3.5 w-16 rounded animate-shimmer bg-muted" />
        <div className="h-7 w-52 rounded animate-shimmer bg-muted" />
        <div className="h-4 w-80 rounded animate-shimmer bg-muted" />
      </div>

      {/* Subject / preview fields */}
      <div className="space-y-4 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="space-y-2">
          <div className="h-4 w-16 rounded animate-shimmer bg-muted" />
          <div className="h-10 w-full rounded-lg animate-shimmer bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded animate-shimmer bg-muted" />
          <div className="h-10 w-full rounded-lg animate-shimmer bg-muted" />
        </div>
      </div>

      {/* Merge variables */}
      <div className="space-y-2 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="h-4 w-32 rounded animate-shimmer bg-muted" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 w-28 rounded-full animate-shimmer bg-muted" />
          ))}
        </div>
      </div>

      {/* Editor JSON area */}
      <div className="space-y-2 rounded-xl bg-card p-5 shadow-sm ring-1 ring-foreground/[0.06]">
        <div className="h-4 w-24 rounded animate-shimmer bg-muted" />
        <div className="h-64 w-full rounded-lg animate-shimmer bg-muted" />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-32 rounded-lg animate-shimmer bg-muted" />
        <div className="flex gap-3">
          <div className="h-9 w-24 rounded-lg animate-shimmer bg-muted" />
          <div className="h-9 w-32 rounded-lg animate-shimmer bg-muted" />
        </div>
      </div>
    </div>
  )
}
