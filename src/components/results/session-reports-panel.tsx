"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getSessionSnapshots, type SessionDetailSnapshot } from "@/app/actions/sessions";
import { retrySnapshot } from "@/app/actions/reports";
import { LocalTime } from "@/components/local-time";
import { ReportPdfButton } from "@/components/reports/report-pdf-button";
import {
  getSessionProcessingStatusLabel,
  isSessionProcessingActive,
} from "@/lib/assess/session-processing";
import {
  getReportStatusLabel,
  getReportStatusVariant,
  isReportGenerating,
  isReportViewable,
} from "@/lib/reports/status";
import type { ParticipantSessionProcessingStatus } from "@/types/database";

interface SessionReportsPanelProps {
  sessionId: string;
  initialSnapshots: SessionDetailSnapshot[];
  sessionStatus: string;
  processingStatus: ParticipantSessionProcessingStatus;
  processingError?: string;
}

function audienceLabel(a: string): string {
  if (a === "participant") return "Participant";
  if (a === "hr_manager") return "HR Manager";
  if (a === "consultant") return "Consultant";
  return a;
}

const PDF_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  queued: "secondary",
  generating: "secondary",
  ready: "default",
  failed: "destructive",
};

function pdfStatusLabel(status: string): string {
  if (status === "queued") return "PDF queued";
  if (status === "generating") return "PDF generating";
  if (status === "ready") return "PDF ready";
  if (status === "failed") return "PDF failed";
  return status;
}

export function SessionReportsPanel({
  sessionId,
  initialSnapshots,
  sessionStatus,
  processingStatus,
  processingError,
}: SessionReportsPanelProps) {
  const [snapshots, setSnapshots] = useState(initialSnapshots);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const next = await getSessionSnapshots(sessionId);
      setSnapshots(next);
    } catch {
      toast.error("Failed to refresh snapshots");
    } finally {
      setIsRefreshing(false);
    }
  }, [sessionId]);

  useEffect(() => {
    const hasActive = snapshots.some(
      (s) =>
        isReportGenerating(s.status) ||
        s.pdfStatus === "queued" ||
        s.pdfStatus === "generating"
    );
    if (!hasActive) return;

    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [snapshots, refresh]);

  function handleRetry(id: string) {
    startTransition(async () => {
      try {
        await retrySnapshot(id);
        toast.success("Retrying report generation");
        await refresh();
      } catch {
        toast.error("Failed to retry");
      }
    });
  }

  if (snapshots.length === 0) {
    const description =
      sessionStatus !== "completed"
        ? "Reports can be generated after the participant completes the assessment."
        : processingStatus === "failed"
          ? processingError ??
            "This session completed, but report preparation could not start."
          : isSessionProcessingActive(processingStatus)
            ? `This session is still ${getSessionProcessingStatusLabel(
                processingStatus,
              ).toLowerCase()}. Reports will appear here once processing finishes.`
            : "Reports are generated automatically when this campaign has report templates configured.";

    return (
      <EmptyState
        title="No reports generated yet"
        description={description}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`size-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {snapshots.map((snapshot) => (
        <Card key={snapshot.id}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium truncate">
                  {snapshot.templateName ?? "Template"}
                </p>
                <Badge variant="outline" className="text-xs">
                  {audienceLabel(snapshot.audienceType)}
                </Badge>
                <Badge variant={getReportStatusVariant(snapshot.status)}>
                  {getReportStatusLabel(snapshot.status)}
                </Badge>
                {snapshot.pdfStatus && (
                  <Badge
                    variant={PDF_STATUS_VARIANT[snapshot.pdfStatus] ?? "outline"}
                  >
                    {pdfStatusLabel(snapshot.pdfStatus)}
                  </Badge>
                )}
              </div>
              <p className="text-caption text-muted-foreground mt-1">
                {snapshot.generatedAt ? (
                  <>
                    Generated <LocalTime iso={snapshot.generatedAt} format="relative" />
                  </>
                ) : (
                  "Queued"
                )}
                {snapshot.errorMessage && (
                  <span className="text-destructive ml-2">
                    · {snapshot.errorMessage}
                  </span>
                )}
                {snapshot.pdfStatus === "failed" && snapshot.pdfErrorMessage && (
                  <span className="text-destructive ml-2">
                    · {snapshot.pdfErrorMessage}
                  </span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isReportViewable(snapshot.status) && (
                <Link
                  href={`/reports/${snapshot.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Preview
                  <ExternalLink className="size-3.5" />
                </Link>
              )}
              {snapshot.status === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRetry(snapshot.id)}
                >
                  Retry
                </Button>
              )}
              {isReportViewable(snapshot.status) && (
                <ReportPdfButton
                  snapshotId={snapshot.id}
                  initialPdfUrl={snapshot.pdfUrl}
                  initialPdfStatus={snapshot.pdfStatus}
                  size="sm"
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
