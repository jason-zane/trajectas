import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'

export default function Loading() {
  return (
    <div className="space-y-8 max-w-6xl">
      <PageHeader
        eyebrow="Psychometrics"
        title="Construct Reliability"
        description="Internal consistency and measurement precision for each scale in your library."
      />

      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} variant="glass">
            <CardContent className="py-4">
              <div className="h-10 w-24 bg-muted animate-shimmer rounded" />
              <div className="h-3 w-32 bg-muted animate-shimmer rounded mt-3" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} variant="interactive" className="border-l-[3px] border-l-muted">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="size-10 shrink-0 rounded-xl bg-muted animate-shimmer" />
                  <div className="flex-1">
                    <div className="h-5 w-32 bg-muted animate-shimmer rounded" />
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="h-8 w-20 bg-muted animate-shimmer rounded" />
              <div className="h-2 w-full bg-muted animate-shimmer rounded" />
              <div className="grid grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j}>
                    <div className="h-4 w-16 bg-muted animate-shimmer rounded mb-2" />
                    <div className="h-3 w-20 bg-muted animate-shimmer rounded" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
