import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"
import { Card, CardContent } from "@/components/ui/card"

export default function InviteDetailLoading() {
  return (
    <div className="space-y-8 max-w-2xl">
      <div className="flex items-center gap-2">
        <Shimmer className="h-5 w-5" />
        <PageHeaderSkeleton eyebrow={false} description />
      </div>

      <Card>
        <CardContent className="pt-6 space-y-6">
          <div className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-5 w-40" />
          </div>
          <div className="space-y-2">
            <Shimmer className="h-4 w-24" />
            <Shimmer className="h-5 w-32" />
          </div>
          <Shimmer className="h-10 w-full rounded-lg" />
        </CardContent>
      </Card>
    </div>
  )
}
