import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPdfButton } from "@/components/reports/report-pdf-button";
import {
  getReportStatusLabel,
  getReportStatusVariant,
  isReportViewable,
} from "@/lib/reports/status";
import type { ReportSnapshot } from "@/types/database";


const pdfStatusVariant: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  generating: "secondary",
  ready: "default",
  failed: "destructive",
};

const pdfStatusLabel: Record<string, string> = {
  queued: "PDF queued",
  generating: "PDF generating",
  ready: "PDF ready",
  failed: "PDF failed",
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
                <Badge
                  variant={getReportStatusVariant(snapshot.status)}
                  className={`text-xs shrink-0 ${
                    snapshot.status === "released"
                      ? "bg-green-500/15 text-green-700 border-green-500/30"
                      : snapshot.status === "ready"
                        ? "bg-blue-500/15 text-blue-700 border-blue-500/30"
                        : ""
                  }`}
                >
                  {getReportStatusLabel(snapshot.status)}
                </Badge>
                {snapshot.pdfStatus && (
                  <Badge
                    variant={pdfStatusVariant[snapshot.pdfStatus] ?? "secondary"}
                    className="text-xs shrink-0"
                  >
                    {pdfStatusLabel[snapshot.pdfStatus] ?? snapshot.pdfStatus}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {snapshot.narrativeMode === "ai_enhanced"
                    ? "AI Enhanced"
                    : "Derived"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {relativeTime(snapshot.created_at)}
                </span>
                {snapshot.pdfStatus === "failed" && snapshot.pdfErrorMessage && (
                  <span className="text-xs text-destructive">
                    {snapshot.pdfErrorMessage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isReportViewable(snapshot.status) ? (
                  <Link
                    href={`/reports/${snapshot.id}`}
                    className="inline-flex h-8 items-center rounded-md border border-input px-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    Preview
                  </Link>
                ) : null}
                {isReportViewable(snapshot.status) && (
                  <ReportPdfButton
                    snapshotId={snapshot.id}
                    initialPdfUrl={snapshot.pdfUrl}
                    initialPdfStatus={snapshot.pdfStatus}
                    size="sm"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
