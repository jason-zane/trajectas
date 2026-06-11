import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"
import { Card, CardContent } from "@/components/ui/card"

export default function PresetsLoading() {
  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeaderSkeleton eyebrow description />
        <Shimmer className="h-10 w-32 rounded-lg shrink-0" />
      </div>

      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-start justify-between py-4">
              <div className="min-w-0 flex-1 space-y-2">
                <Shimmer className="h-5 w-48" />
                <Shimmer className="h-3 w-64" />
              </div>
              <Shimmer className="h-5 w-20 shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
