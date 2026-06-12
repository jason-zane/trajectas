import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { DetailFormSkeleton } from "@/components/loading/detail-form-skeleton"

export default function BandSchemeLoading() {
  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeaderSkeleton eyebrow description />
      <DetailFormSkeleton sections={2} fieldsPerSection={2} />
    </div>
  )
}
