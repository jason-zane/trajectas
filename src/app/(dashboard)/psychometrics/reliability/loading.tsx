import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"
import { Card, CardContent } from "@/components/ui/card"

export default function ReliabilityLoading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeaderSkeleton eyebrow description />

      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} variant="glass">
            <CardContent className="pt-6">
              <Shimmer className="h-8 w-24 mb-2" />
              <Shimmer className="h-4 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-l-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <Shimmer className="h-5 w-40" />
                <Shimmer className="h-8 w-20 rounded-lg" />
              </div>
              <Shimmer className="h-2 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
