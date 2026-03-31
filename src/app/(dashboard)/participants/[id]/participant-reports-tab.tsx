import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReleaseSnapshotButton } from "@/app/(dashboard)/reports/[snapshotId]/release-snapshot-button";
import type { ReportSnapshot } from "@/types/database";

const audienceLabel: Record<string, string> = {
  participant: "Participant",
  hr_manager: "HR Manager",
  consultant: "Consultant",
};

const statusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  pending: "secondary",
  generating: "secondary",
  ready: "default",
  released: "default",
  failed: "destructive",
};

const statusLabel: Record<string, string> = {
  pending: "Pending",
  generating: "Generating",
  ready: "Ready",
  released: "Released",
  failed: "Failed",
};

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ParticipantReportsTab({
  snapshots,
}: {
  snapshots: ReportSnapshot[];
}) {
  if (snapshots.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No reports generated yet — reports are created automatically when a
          participant completes a campaign with report templates configured.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Report Snapshots</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {snapshots.map((snapshot) => (
            <div
              key={snapshot.id}
              className="flex flex-wrap items-center gap-3 px-6 py-3"
            >
              <div className="flex flex-1 flex-wrap items-center gap-3 min-w-0">
                <Badge variant="outline" className="text-xs shrink-0">
                  {audienceLabel[snapshot.audienceType] ?? snapshot.audienceType}
                </Badge>
                <Badge
                  variant={statusVariant[snapshot.status] ?? "secondary"}
                  className={`text-xs shrink-0 ${
                    snapshot.status === "released"
                      ? "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30"
                      : snapshot.status === "ready"
                        ? "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30"
                        : ""
                  }`}
                >
                  {statusLabel[snapshot.status] ?? snapshot.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {snapshot.narrativeMode === "ai_enhanced"
                    ? "AI Enhanced"
                    : "Derived"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(snapshot.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/reports/${snapshot.id}`} />}
                >
                  Preview
                </Button>
                {snapshot.status === "ready" && (
                  <ReleaseSnapshotButton snapshotId={snapshot.id} />
                )}
                {snapshot.pdfUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    render={<a href={snapshot.pdfUrl} target="_blank" rel="noreferrer" />}
                  >
                    Download PDF
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
