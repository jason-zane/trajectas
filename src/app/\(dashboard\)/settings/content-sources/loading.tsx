import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"
import { Card, CardContent } from "@/components/ui/card"

export default function ContentSourcesLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton eyebrow description />

      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Shimmer className="h-10 flex-1" />
            <Shimmer className="h-10 flex-1" />
            <Shimmer className="h-9 w-24" />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center justify-between py-4">
              <Shimmer className="h-5 w-40" />
              <div className="flex gap-2">
                <Shimmer className="h-8 w-8" />
                <Shimmer className="h-8 w-8" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
