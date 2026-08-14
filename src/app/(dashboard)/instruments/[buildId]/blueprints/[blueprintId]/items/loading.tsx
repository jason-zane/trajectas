import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ItemsLoading() {
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Summary strip */}
      <Card className="p-6">
        <div className="grid gap-6 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      </Card>

      {/* Generate button */}
      <Skeleton className="h-10 w-64" />

      {/* Cell groups */}
      <div className="space-y-6">
        {[1, 2, 3].map((groupIdx) => (
          <Card key={groupIdx} className="overflow-hidden">
            {/* Cell header */}
            <div className="border-b bg-muted/30 px-6 py-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>

            {/* Items */}
            <div className="divide-y">
              {[1, 2].map((itemIdx) => (
                <div key={itemIdx} className="px-6 py-3">
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
