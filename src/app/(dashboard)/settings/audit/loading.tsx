import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"
import { Card, CardContent } from "@/components/ui/card"

export default function SettingsAuditLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton eyebrow description />

      <Card>
        <CardContent className="space-y-4 py-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Shimmer className="h-10 flex-1" />
            <Shimmer className="h-10 flex-1" />
            <Shimmer className="h-9 w-28" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start justify-between gap-6 px-5 py-3.5">
                <div className="min-w-0 flex-1 space-y-2">
                  <Shimmer className="h-4 w-3/4" />
                  <Shimmer className="h-3 w-1/2" />
                </div>
                <Shimmer className="h-3 w-32 shrink-0" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
