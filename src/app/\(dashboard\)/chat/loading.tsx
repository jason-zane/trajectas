import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"

export default function ChatLoading() {
  return (
    <div className="flex flex-col h-[calc(100dvh-theme(spacing.16))]">
      <div className="px-6 py-4 border-b border-border">
        <PageHeaderSkeleton eyebrow description={false} />
      </div>

      <div className="flex-1 min-h-0 mt-4 px-6 overflow-auto space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-12 w-4/5" />
        ))}
      </div>

      <div className="p-4 border-t border-border">
        <Shimmer className="h-12 w-full rounded-lg" />
      </div>
    </div>
  )
}
