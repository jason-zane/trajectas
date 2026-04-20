import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function AdminCampaignAssessmentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-start justify-between space-y-0">
            <div className="space-y-2">
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-8 w-24 rounded-lg" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-4">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
