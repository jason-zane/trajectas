import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { CardGridSkeleton } from "@/components/loading/card-grid-skeleton"

export default function NormsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeaderSkeleton eyebrow description />
      <CardGridSkeleton count={4} columns={2} />
    </div>
  )
}
