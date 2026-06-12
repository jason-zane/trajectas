import { PageHeaderSkeleton } from "@/components/loading/page-header-skeleton"
import { Shimmer } from "@/components/loading/shimmer"
import { Card, CardContent } from "@/components/ui/card"

export default function SettingsMigrationsLoading() {
  return (
    <div className="space-y-8">
      <PageHeaderSkeleton eyebrow description />

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-6 px-5 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Shimmer className="h-3.5 w-3.5 shrink-0" />
                  <Shimmer className="h-4 w-40" />
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <Shimmer className="h-6 w-40" />
                  <Shimmer className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
