import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { CardGridSkeleton } from "@/components/loading/card-grid-skeleton"

export default function ItemHealthLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeaderSkeleton eyebrow description />
      <CardGridSkeleton count={6} columns={2} />
    </div>
  )
}
