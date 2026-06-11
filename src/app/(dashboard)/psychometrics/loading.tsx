import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { CardGridSkeleton } from "@/components/loading/card-grid-skeleton"

export default function PsychometricsLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeaderSkeleton eyebrow description />
      <CardGridSkeleton count={3} columns={3} />
    </div>
  )
}
