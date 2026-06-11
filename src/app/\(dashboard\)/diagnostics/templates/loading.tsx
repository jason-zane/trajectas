import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { CardGridSkeleton } from "@/components/loading/card-grid-skeleton"

export default function DiagnosticTemplatesLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <PageHeaderSkeleton eyebrow={false} description />
      </div>
      <CardGridSkeleton count={4} columns={2} />
    </div>
  )
}
