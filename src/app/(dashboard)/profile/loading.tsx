import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { DetailFormSkeleton } from "@/components/loading/detail-form-skeleton"

export default function ProfileLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeaderSkeleton eyebrow={false} description={false} />
      <DetailFormSkeleton sections={2} fieldsPerSection={2} />
    </div>
  )
}
