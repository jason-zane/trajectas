import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { DetailFormSkeleton } from "@/components/loading/detail-form-skeleton"

export default function EditPresetLoading() {
  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <PageHeaderSkeleton eyebrow description />
      <DetailFormSkeleton sections={3} fieldsPerSection={2} />
    </div>
  )
}
